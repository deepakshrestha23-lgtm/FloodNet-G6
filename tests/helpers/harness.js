/**
 * Shared test harness.
 *
 * Tests run against a dedicated `<DB_NAME>_test` database so a test run can
 * never truncate development data. Environment values are set here, before the
 * application is required, because `server/config/env.js` reads configuration
 * once at load time and dotenv does not overwrite variables that already exist.
 */
const path = require('path');
const fs = require('fs');

const rootDirectory = path.join(__dirname, '..', '..');

require('dotenv').config({ path: path.join(rootDirectory, '.env') });

const developmentDatabase = process.env.DB_NAME || 'floodnet';
const testDatabase = process.env.TEST_DB_NAME || `${developmentDatabase}_test`;

process.env.NODE_ENV = 'test';
process.env.DB_NAME = testDatabase;
// Evidence tests exercise validation, metadata and authorization. Object bytes
// are not sent to AWS during tests, so no credentials or bucket are required.
process.env.EVIDENCE_STORAGE_MODE = 'mock';
// Conditions run against deterministic values. A test run must never depend
// on Open-Meteo being reachable, and must never make an outbound call.
process.env.WEATHER_MODE = 'mock';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-value-for-automated-tests';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-value-for-automated-tests';
process.env.EVIDENCE_UPLOAD_SECRET = process.env.EVIDENCE_UPLOAD_SECRET || 'test-evidence-secret-value-for-tests';

const { Client } = require('pg');

const TEST_PASSWORD = 'TestPassw0rd';

let serverInstance = null;
let baseUrl = null;

function adminConnectionConfig(database) {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
}

async function ensureTestDatabase() {
  const client = new Client(adminConnectionConfig('postgres'));
  await client.connect();

  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDatabase]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE ${testDatabase}`);
  }

  await client.end();
}

/**
 * Applies any migration the test database has not seen yet. Each file is
 * tracked individually so a migration added later is picked up rather than
 * being skipped because the tracking table already exists.
 */
async function applyMigrations() {
  const client = new Client(adminConnectionConfig(testDatabase));
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDirectory = path.join(rootDirectory, 'server', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDirectory).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (existing.rowCount > 0) continue;

    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(path.join(migrationsDirectory, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`test migration ${file} failed: ${error.message}`);
    }
  }

  await client.end();
}

/**
 * Returns the database to a known state between test files. Reference data and
 * the four role accounts are recreated so every file starts identically.
 */
async function resetDatabase() {
  const { pool } = require('../../server/db/pool');
  const { hashPassword } = require('../../server/utils/password');

  await pool.query(`
    TRUNCATE
      audit_logs, notification_logs, notification_preferences,
      flood_evidence_metadata, flood_report_status_history, flood_report_reviews,
      flood_reports, alert_wards, alert_zones, flood_alerts,
      centre_facilities, evacuation_centres, centre_facility_types,
      user_jurisdictions, auth_sessions, user_profiles, users, flood_zone_wards,
      flood_zones, geo_wards, geo_local_levels, geo_districts, geo_provinces, roles
    RESTART IDENTITY CASCADE
  `);

  await pool.query(`
    INSERT INTO roles (code, display_name) VALUES
      ('RESIDENT', 'Resident'),
      ('FLOOD_MONITORING_OFFICER', 'Flood Monitoring Officer'),
      ('EVACUATION_OFFICER', 'Evacuation Officer'),
      ('ADMINISTRATOR', 'System Administrator')
  `);

  await pool.query(`
    INSERT INTO flood_zones (code, name, locality, description) VALUES
      ('ZONE-A', 'Riverbank North', 'North District', 'Northern riverbank communities'),
      ('ZONE-B', 'Central Lowlands', 'Central District', 'Central low-lying communities'),
      ('ZONE-C', 'South Valley', 'South District', 'Southern valley communities')
  `);

  await pool.query(`
    INSERT INTO centre_facility_types (code, display_name) VALUES
      ('DRINKING_WATER', 'Drinking water'),
      ('FOOD', 'Food'),
      ('FIRST_AID', 'First aid / medical assistance'),
      ('TOILETS', 'Toilets')
  `);

  await pool.query(`
    INSERT INTO geo_provinces (source_id, code, name, sort_order)
    VALUES (1, 'NP-P01', 'Test Province', 1)
  `);
  await pool.query(`
    INSERT INTO geo_districts (source_id, province_id, code, name, sort_order)
    VALUES (1, (SELECT id FROM geo_provinces WHERE source_id = 1), 'NP-D01', 'Test District', 1)
  `);
  await pool.query(`
    INSERT INTO geo_local_levels (source_id, district_id, code, name, type, ward_count, sort_order)
    VALUES (1, (SELECT id FROM geo_districts WHERE source_id = 1), 'NP-LL001', 'Test Municipality', 'MUNICIPALITY', 2, 1)
  `);
  await pool.query(`
    INSERT INTO geo_wards (source_key, local_level_id, ward_number, name)
    VALUES
      ('1-1', (SELECT id FROM geo_local_levels WHERE source_id = 1), 1, 'Ward 1'),
      ('1-2', (SELECT id FROM geo_local_levels WHERE source_id = 1), 2, 'Ward 2')
  `);
  await pool.query(`
    INSERT INTO flood_zone_wards (zone_id, ward_id, is_primary)
    SELECT z.id, w.id, TRUE
    FROM flood_zones z
    INNER JOIN geo_wards w ON w.ward_number = CASE z.code WHEN 'ZONE-A' THEN 1 WHEN 'ZONE-B' THEN 2 ELSE 1 END
  `);

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const accounts = [
    ['resident@test.local', 'RESIDENT', 'Rina', 'Resident'],
    ['resident2@test.local', 'RESIDENT', 'Sam', 'Second'],
    ['officer@test.local', 'FLOOD_MONITORING_OFFICER', 'Daniel', 'Officer'],
    ['evacuation@test.local', 'EVACUATION_OFFICER', 'Mei', 'Evacuation'],
    ['admin@test.local', 'ADMINISTRATOR', 'Sofia', 'Admin']
  ];

  for (const [email, roleCode, firstName, lastName] of accounts) {
    const user = await pool.query(
      `INSERT INTO users (role_id, email, password_hash)
       VALUES ((SELECT id FROM roles WHERE code = $1), $2, $3) RETURNING id`,
      [roleCode, email, passwordHash]
    );

    await pool.query(
      'INSERT INTO user_profiles (user_id, first_name, last_name) VALUES ($1, $2, $3)',
      [user.rows[0].id, firstName, lastName]
    );
  }

  await pool.query(`
    INSERT INTO user_jurisdictions (user_id, scope_level)
    SELECT u.id, 'NATIONAL'
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE r.code IN ('FLOOD_MONITORING_OFFICER', 'EVACUATION_OFFICER')
  `);
}

async function startServer() {
  if (serverInstance) return baseUrl;

  await ensureTestDatabase();
  await applyMigrations();

  const app = require('../../server/app');

  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${serverInstance.address().port}`;
  return baseUrl;
}

async function stopServer() {
  const { pool } = require('../../server/db/pool');

  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
    serverInstance = null;
  }

  if (pool) await pool.end();
}

/** Minimal cookie-aware client so refresh-token behaviour matches a browser. */
function createClient() {
  return { cookies: new Map(), accessToken: null, user: null };
}

async function request(client, method, urlPath, body, options = {}) {
  const headers = {};

  if (body !== undefined && !options.form) headers['Content-Type'] = 'application/json';
  if (client.accessToken && !options.anonymous) headers.Authorization = `Bearer ${client.accessToken}`;
  if (client.cookies.size) {
    headers.Cookie = [...client.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  const response = await fetch(baseUrl + urlPath, {
    method,
    headers,
    body: body === undefined ? undefined : (options.form ? body : JSON.stringify(body))
  });

  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    client.cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  }

  return { status: response.status, body: payload };
}

async function signIn(email, password = TEST_PASSWORD) {
  const client = createClient();
  const result = await request(client, 'POST', '/api/auth/login', { email, password });

  if (result.status !== 200) {
    throw new Error(`sign-in failed for ${email}: ${result.status} ${JSON.stringify(result.body)}`);
  }

  client.accessToken = result.body.data.accessToken;
  client.user = result.body.data.user;
  return client;
}

async function getZones() {
  const result = await request(createClient(), 'GET', '/api/public/zones');
  return result.body.data.zones;
}

/** Creates a report owned by the given resident and returns the report object. */
async function createReport(residentClient, zoneId, overrides = {}) {
  const result = await request(residentClient, 'POST', '/api/reports', {
    zoneId,
    locationDescription: 'Test location beside the bridge',
    observedSeverity: 'HIGH',
    roadCondition: 'BLOCKED',
    incidentDescription: 'Water covering both lanes of the road.',
    observedAt: new Date(Date.now() - 3600_000).toISOString(),
    ...overrides
  });

  if (result.status !== 201) {
    throw new Error(`report creation failed: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return result.body.data.report;
}

function pngBuffer(sizeBytes = 2048) {
  const buffer = Buffer.alloc(sizeBytes, 0x20);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  return buffer;
}

module.exports = {
  TEST_PASSWORD,
  startServer,
  stopServer,
  resetDatabase,
  createClient,
  request,
  signIn,
  getZones,
  createReport,
  pngBuffer
};
