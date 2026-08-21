/**
 * Who can see an alert, and who can see a centre.
 *
 * These cover reachability rather than the create and publish rules. An alert
 * nobody can see is the same as an alert that was never published, and that
 * failure is silent, so it needs explicit cover.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer,
  stopServer,
  resetDatabase,
  createClient,
  request,
  signIn,
  getZones
} = require('./helpers/harness');

let officer;
let evacuation;
let zones;

async function firstWardOfZone(zoneCode) {
  const { pool } = require('../server/db/pool');
  const result = await pool.query(
    `SELECT fzw.ward_id FROM flood_zone_wards fzw
     INNER JOIN flood_zones z ON z.id = fzw.zone_id
     WHERE z.code = $1 LIMIT 1`,
    [zoneCode]
  );
  return result.rows[0] ? result.rows[0].ward_id : null;
}

async function publishAlert(overrides) {
  const created = await request(officer, 'POST', '/api/officer/alerts', {
    title: 'Reachability check',
    severity: 'WARNING',
    warningDescription: 'Levels are rising along the corridor.',
    recommendedActions: 'Move valuables above expected water levels.',
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
    zoneIds: [],
    wardIds: [],
    ...overrides
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const alertId = created.body.data.alert.id;
  const published = await request(officer, 'POST', `/api/officer/alerts/${alertId}/publish`);
  assert.equal(published.status, 200, JSON.stringify(published.body));
  return alertId;
}

test.before(async () => {
  await startServer();
  await resetDatabase();
  officer = await signIn('officer@test.local');
  evacuation = await signIn('evacuation@test.local');
  zones = await getZones();
});

test.after(async () => {
  await stopServer();
});

test('a zone-targeted alert reaches a resident filtering by a ward that zone covers', async () => {
  const zone = zones.find((z) => z.code === 'ZONE-A');
  const coveredWard = await firstWardOfZone('ZONE-A');
  assert.ok(coveredWard, 'the harness must map ZONE-A to a ward');

  const alertId = await publishAlert({ zoneIds: [zone.id] });

  // A resident knows their ward, not the operational zone it sits inside.
  const byWard = await request(createClient(), 'GET', `/api/public/alerts?wardId=${coveredWard}`);
  assert.equal(byWard.status, 200);
  assert.ok(
    byWard.body.data.alerts.some((a) => a.id === alertId),
    'a zone-targeted alert must reach the wards that zone covers'
  );
});

test('a ward-targeted alert reaches a resident filtering by the zone covering it', async () => {
  const zone = zones.find((z) => z.code === 'ZONE-B');
  const coveredWard = await firstWardOfZone('ZONE-B');
  const alertId = await publishAlert({ wardIds: [coveredWard] });

  const byZone = await request(createClient(), 'GET', `/api/public/alerts?zoneId=${zone.id}`);
  assert.ok(
    byZone.body.data.alerts.some((a) => a.id === alertId),
    'a ward-targeted alert must reach the zone that covers that ward'
  );
});

test('widening reachability does not make every alert visible everywhere', async () => {
  const zoneC = zones.find((z) => z.code === 'ZONE-C');
  const alertId = await publishAlert({ zoneIds: [zoneC.id] });

  const wardC = await firstWardOfZone('ZONE-C');
  const wardA = await firstWardOfZone('ZONE-A');

  if (wardA && wardA !== wardC) {
    const elsewhere = await request(createClient(), 'GET', `/api/public/alerts?wardId=${wardA}`);
    assert.ok(
      !elsewhere.body.data.alerts.some((a) => a.id === alertId),
      'an unrelated ward must still not see it'
    );
  }
});

test('the public alert response reports how many are live in total', async () => {
  const zone = zones.find((z) => z.code === 'ZONE-A');
  const scoped = await request(createClient(), 'GET', `/api/public/alerts?zoneId=${zone.id}`);
  const everywhere = await request(createClient(), 'GET', '/api/public/alerts');

  assert.equal(typeof scoped.body.data.totalActive, 'number');
  assert.equal(
    scoped.body.data.totalActive,
    everywhere.body.data.alerts.length,
    'totalActive must count every live alert, not only the filtered ones'
  );
  assert.ok(
    scoped.body.data.alerts.length <= scoped.body.data.totalActive,
    'a resident can never be shown more than exist'
  );
});

test('an expired alert stops being shown even while its status is still PUBLISHED', async () => {
  const zone = zones.find((z) => z.code === 'ZONE-A');
  const alertId = await publishAlert({ zoneIds: [zone.id] });

  // Expiry is an explicit officer action, so a published alert can sit past
  // its own window. The window, not the status alone, decides visibility.
  const { pool } = require('../server/db/pool');
  await pool.query(
    "UPDATE flood_alerts SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1",
    [alertId]
  );

  const result = await request(createClient(), 'GET', '/api/public/alerts');
  assert.ok(
    !result.body.data.alerts.some((a) => a.id === alertId),
    'a published alert past its window must stop being shown'
  );
});

test('an evacuation officer can read the alerts they are responding to', async () => {
  const zone = zones.find((z) => z.code === 'ZONE-A');
  const alertId = await publishAlert({ zoneIds: [zone.id] });

  const result = await request(evacuation, 'GET', '/api/centres/alerts');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.ok(
    result.body.data.alerts.some((a) => a.id === alertId),
    'the officer who opens shelters must see the warning that requires them'
  );
});

test('an evacuation officer still cannot create or publish an alert', async () => {
  const zone = zones.find((z) => z.code === 'ZONE-A');

  const created = await request(evacuation, 'POST', '/api/officer/alerts', {
    title: 'Should not be permitted',
    severity: 'WARNING',
    warningDescription: 'Attempted from the wrong role entirely.',
    recommendedActions: 'This request must not be accepted.',
    validFrom: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    zoneIds: [zone.id],
    wardIds: []
  });

  assert.equal(created.status, 403, 'publishing stays with the monitoring officer');
});

test('a resident cannot reach the evacuation officer alert view', async () => {
  const resident = await signIn('resident@test.local');
  const result = await request(resident, 'GET', '/api/centres/alerts');
  assert.equal(result.status, 403);
});

test('a zone-only centre is reachable by ward, and centres with room come first', async () => {
  const zone = zones.find((z) => z.code === 'ZONE-A');
  const coveredWard = await firstWardOfZone('ZONE-A');

  // New writes require a ward, but existing Task 1 records may predate that
  // rule. Insert a legacy row directly to prove the compatibility read path.
  const { pool } = require('../server/db/pool');
  await pool.query(
    `INSERT INTO evacuation_centres (
       zone_id, name, location_description, maximum_capacity,
       current_occupancy, operational_status, updated_by
     ) VALUES ($1, $2, $3, 100, 0, 'OPEN', $4)`,
    [zone.id, 'Zone Only Shelter', 'Legacy record with an operational area but no ward', evacuation.user.id]
  );

  const byWard = await request(createClient(), 'GET', `/api/public/centres?wardId=${coveredWard}`);
  assert.equal(byWard.status, 200);
  assert.ok(
    byWard.body.data.centres.some((c) => c.name === 'Zone Only Shelter'),
    'a zone-only centre must reach residents in the wards that zone covers'
  );
  assert.equal(typeof byWard.body.data.totalActive, 'number');

  const all = await request(createClient(), 'GET', '/api/public/centres');
  const rank = { OPEN: 1, NEAR_CAPACITY: 2, FULL: 3, CLOSED: 4 };
  const ranks = all.body.data.centres.map((c) => rank[c.operationalStatus] ?? 4);
  assert.deepEqual(
    ranks,
    [...ranks].sort((a, b) => a - b),
    'centres with room must be listed before those without'
  );
});
