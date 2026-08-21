const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TEST_PASSWORD,
  startServer,
  stopServer,
  resetDatabase,
  createClient,
  request,
  signIn
} = require('./helpers/harness');

test.before(async () => {
  await startServer();
  await resetDatabase();
});

test.after(async () => {
  await stopServer();
});

test('health endpoint reports the application is running', async () => {
  const result = await request(createClient(), 'GET', '/api/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test('database health endpoint reports a live connection', async () => {
  const result = await request(createClient(), 'GET', '/api/health/db');
  assert.equal(result.status, 200);
  assert.equal(result.body.data.database.connected, true);
});

test('a resident can register and then sign in', async () => {
  const client = createClient();
  const email = `new-resident-${Date.now()}@test.local`;

  const registered = await request(client, 'POST', '/api/auth/register', {
    email,
    password: 'BrandNewPass1',
    firstName: 'New',
    lastName: 'Resident'
  });
  assert.equal(registered.status, 201);

  const signedIn = await signIn(email, 'BrandNewPass1');
  assert.equal(signedIn.user.role.code, 'RESIDENT');
});

test('registration rejects a weak password', async () => {
  const result = await request(createClient(), 'POST', '/api/auth/register', {
    email: `weak-${Date.now()}@test.local`,
    password: 'weak',
    firstName: 'Weak',
    lastName: 'Password'
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
});

test('registration rejects a duplicate email address', async () => {
  const result = await request(createClient(), 'POST', '/api/auth/register', {
    email: 'resident@test.local',
    password: 'AnotherPass1',
    firstName: 'Duplicate',
    lastName: 'Resident'
  });

  assert.equal(result.status, 409);
});

test('sign-in fails with an incorrect password', async () => {
  const result = await request(createClient(), 'POST', '/api/auth/login', {
    email: 'resident@test.local',
    password: 'NotThePassword1'
  });

  assert.equal(result.status, 401);
});

test('authentication responses never contain the password hash', async () => {
  const client = await signIn('resident@test.local');
  const me = await request(client, 'GET', '/api/auth/me');

  assert.equal(me.status, 200);
  assert.ok(!JSON.stringify(me.body).toLowerCase().includes('passwordhash'));
  assert.ok(!JSON.stringify(me.body).includes(TEST_PASSWORD));
});

test('a protected route rejects a request with no token', async () => {
  const result = await request(createClient(), 'GET', '/api/auth/me');
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('a protected route rejects a malformed token', async () => {
  const client = createClient();
  client.accessToken = 'clearly-not-a-jwt';

  const result = await request(client, 'GET', '/api/auth/me');
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'INVALID_ACCESS_TOKEN');
});

test('refresh issues a new access token and logout revokes the session', async () => {
  const client = await signIn('resident@test.local');

  const refreshed = await request(client, 'POST', '/api/auth/refresh');
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.data.accessToken);

  const loggedOut = await request(client, 'POST', '/api/auth/logout');
  assert.equal(loggedOut.status, 200);

  const afterLogout = await request(client, 'POST', '/api/auth/refresh');
  assert.equal(afterLogout.status, 401);
});

/**
 * Refresh tokens rotate on every use. Pages routinely fire several requests at
 * once, and React mounts effects twice in development, so simultaneous
 * refreshes must not invalidate each other and log the user out.
 */
test('concurrent refreshes with the same token all succeed', async () => {
  const client = await signIn('resident@test.local');

  const results = await Promise.all([
    request(client, 'POST', '/api/auth/refresh'),
    request(client, 'POST', '/api/auth/refresh'),
    request(client, 'POST', '/api/auth/refresh')
  ]);

  for (const result of results) {
    assert.equal(result.status, 200, 'a concurrent refresh must not be rejected');
    assert.ok(result.body.data.accessToken);
  }

  // The session must still be usable afterwards.
  const after = await request(client, 'POST', '/api/auth/refresh');
  assert.equal(after.status, 200);
});

test('the session survives a burst of parallel authenticated requests', async () => {
  const client = await signIn('resident@test.local');

  const responses = await Promise.all([
    request(client, 'GET', '/api/auth/me'),
    request(client, 'GET', '/api/reports/mine'),
    request(client, 'GET', '/api/centres'),
    request(client, 'GET', '/api/auth/me')
  ]);

  for (const response of responses) {
    assert.equal(response.status, 200);
  }
});

test('a revoked session is still rejected despite the rotation grace window', async () => {
  const client = await signIn('resident@test.local');

  await request(client, 'POST', '/api/auth/refresh');
  await request(client, 'POST', '/api/auth/logout');

  const afterLogout = await request(client, 'POST', '/api/auth/refresh');
  assert.equal(afterLogout.status, 401, 'logout must defeat the grace window');
});

test('an unknown route returns the standard error envelope', async () => {
  const result = await request(createClient(), 'GET', '/api/does-not-exist');

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, 'NOT_FOUND');
});

test('server errors never leak a stack trace to the browser', async () => {
  const client = await signIn('officer@test.local');
  const result = await request(client, 'GET', '/api/officer/reports/00000000-0000-4000-8000-000000000000');

  assert.equal(result.status, 404);
  assert.ok(!JSON.stringify(result.body).includes('at Object'));
  assert.ok(!JSON.stringify(result.body).toLowerCase().includes('select'));
});

/**
 * The home ward is the official administrative location a resident's alerts
 * and evacuation centres are scoped to, so it must survive registration and
 * stay editable afterwards.
 */
async function firstWardId() {
  const provinces = await request(createClient(), 'GET', '/api/geography/provinces');
  const districts = await request(createClient(), 'GET', `/api/geography/districts?provinceId=${provinces.body.data.provinces[0].id}`);
  const localLevels = await request(createClient(), 'GET', `/api/geography/local-levels?districtId=${districts.body.data.districts[0].id}`);
  const wards = await request(createClient(), 'GET', `/api/geography/wards?localLevelId=${localLevels.body.data.localLevels[0].id}`);
  return wards.body.data.wards[0].id;
}

test('a resident can register with a home ward and it is returned on their profile', async () => {
  const wardId = await firstWardId();
  const email = `ward-resident-${Date.now()}@test.local`;

  const registered = await request(createClient(), 'POST', '/api/auth/register', {
    email,
    password: 'BrandNewPass1',
    firstName: 'Ward',
    lastName: 'Resident',
    homeWardId: wardId
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.data.user.profile.homeWardId, wardId);

  const client = await signIn(email, 'BrandNewPass1');
  assert.equal(client.user.profile.homeWardId, wardId);
  // The ancestors travel with the ward so the profile form can repopulate.
  assert.ok(client.user.profile.homeWard.province.name, 'the home ward must carry its province');
  assert.ok(client.user.profile.homeWard.district.name, 'the home ward must carry its district');
});

test('registration rejects an unknown home ward', async () => {
  const result = await request(createClient(), 'POST', '/api/auth/register', {
    email: `bad-ward-${Date.now()}@test.local`,
    password: 'BrandNewPass1',
    firstName: 'Bad',
    lastName: 'Ward',
    homeWardId: '11111111-1111-4111-8111-111111111111'
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_HOME_WARD');
});

test('a resident can set and clear their home ward from their profile', async () => {
  const wardId = await firstWardId();
  const client = await signIn('resident2@test.local');

  const assigned = await request(client, 'PATCH', '/api/auth/me', {
    firstName: 'Sam',
    lastName: 'Second',
    homeWardId: wardId
  });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.data.user.profile.homeWardId, wardId);

  const cleared = await request(client, 'PATCH', '/api/auth/me', {
    firstName: 'Sam',
    lastName: 'Second',
    homeWardId: null
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.user.profile.homeWardId, null);
  assert.equal(cleared.body.data.user.profile.homeWard, null);

  const rejected = await request(client, 'PATCH', '/api/auth/me', {
    firstName: 'Sam',
    lastName: 'Second',
    homeWardId: '11111111-1111-4111-8111-111111111111'
  });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error.code, 'INVALID_HOME_WARD');
});
