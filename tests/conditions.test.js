/**
 * River and rainfall conditions.
 *
 * The harness sets WEATHER_MODE=mock, so nothing here reaches the network: a
 * test run must never depend on a third-party service being up, and must never
 * be the reason a build is flaky.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer,
  stopServer,
  resetDatabase,
  createClient,
  request,
  signIn
} = require('./helpers/harness');

let officer;
let evacuationOfficer;

test.before(async () => {
  await startServer();
  await resetDatabase();
  officer = await signIn('officer@test.local');
  evacuationOfficer = await signIn('evacuation@test.local');
});

test.after(async () => {
  await stopServer();
});

test('an officer receives river and rainfall context for a coordinate', async () => {
  const result = await request(officer, 'GET', '/api/conditions?latitude=27.6939&longitude=85.3140');

  assert.equal(result.status, 200);
  const { conditions } = result.body.data;

  assert.equal(conditions.available, true);
  assert.match(conditions.source, /Open-Meteo/, 'the source must always be attributed');

  assert.equal(conditions.riverDischarge.unit, 'm³/s');
  assert.ok(Number.isFinite(conditions.riverDischarge.today));
  assert.ok(['RISING', 'FALLING', 'STEADY'].includes(conditions.riverDischarge.trend));
  assert.ok(conditions.riverDischarge.days.length > 1, 'a series is needed to show a trend');

  assert.equal(conditions.rainfall.unit, 'mm');
  assert.ok(Number.isFinite(conditions.rainfall.next48hTotal));
});

test('an evacuation officer can also read conditions', async () => {
  const result = await request(evacuationOfficer, 'GET', '/api/conditions?latitude=28.05&longitude=81.6167');

  assert.equal(result.status, 200);
  assert.equal(result.body.data.conditions.available, true);
});

test('the same coordinate returns a stable reading', async () => {
  const first = await request(officer, 'GET', '/api/conditions?latitude=26.869&longitude=87.156');
  const second = await request(officer, 'GET', '/api/conditions?latitude=26.869&longitude=87.156');

  assert.equal(
    first.body.data.conditions.riverDischarge.today,
    second.body.data.conditions.riverDischarge.today,
    'a repeated read must not produce a different number for the same place'
  );
});

test('invalid coordinates are rejected', async () => {
  for (const query of [
    'latitude=200&longitude=85',
    'latitude=27&longitude=999',
    'latitude=abc&longitude=85',
    ''
  ]) {
    const result = await request(officer, 'GET', `/api/conditions?${query}`);
    assert.equal(result.status, 400, `expected 400 for "${query}"`);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
});

test('conditions are not public and not open to residents', async () => {
  const anonymous = await request(createClient(), 'GET', '/api/conditions?latitude=27.69&longitude=85.31');
  assert.equal(anonymous.status, 401, 'the deployment must not be an open proxy to the upstream');

  const resident = await signIn('resident@test.local');
  const asResident = await request(resident, 'GET', '/api/conditions?latitude=27.69&longitude=85.31');
  assert.equal(asResident.status, 403);
});

test('the feature reports itself unavailable when it is switched off', async (t) => {
  // Proves the disabled path, which is what a first deployment runs with.
  const env = require('../server/config/env');
  const original = env.weatherMode;
  env.weatherMode = 'disabled';
  t.after(() => { env.weatherMode = original; });

  const result = await request(officer, 'GET', '/api/conditions?latitude=27.69&longitude=85.31');

  assert.equal(result.status, 200, 'a switched-off feature is not a request failure');
  assert.equal(result.body.data.conditions.available, false);
  assert.ok(result.body.data.conditions.reason);
});

test('an upstream failure degrades instead of erroring', async (t) => {
  const env = require('../server/config/env');
  const weather = require('../server/services/weather.service');
  const originalMode = env.weatherMode;
  const originalFetch = global.fetch;

  env.weatherMode = 'live';
  weather.clearCache();
  global.fetch = (url, options) => (
    String(url).includes('open-meteo.com')
      ? Promise.reject(new Error('simulated upstream outage'))
      : originalFetch(url, options)
  );

  t.after(() => {
    env.weatherMode = originalMode;
    global.fetch = originalFetch;
    weather.clearCache();
  });

  const result = await request(officer, 'GET', '/api/conditions?latitude=29.1&longitude=82.2');

  assert.equal(result.status, 200, 'an outage must not break the officer screen');
  assert.equal(result.body.data.conditions.available, false);
});
