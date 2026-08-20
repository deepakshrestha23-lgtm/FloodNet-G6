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

let resident;
let officer;
let evacuation;
let admin;

test.before(async () => {
  await startServer();
  await resetDatabase();

  resident = await signIn('resident@test.local');
  officer = await signIn('officer@test.local');
  evacuation = await signIn('evacuation@test.local');
  admin = await signIn('admin@test.local');
});

test.after(async () => {
  await stopServer();
});

/**
 * Every protected route is checked against every role that must not reach it.
 * Authorization is a server concern: hiding a button in React is not a control.
 */
const FORBIDDEN = [
  ['resident', () => resident, 'GET', '/api/officer/dashboard'],
  ['resident', () => resident, 'GET', '/api/officer/reports'],
  ['resident', () => resident, 'GET', '/api/officer/alerts'],
  ['resident', () => resident, 'POST', '/api/officer/alerts'],
  ['resident', () => resident, 'GET', '/api/admin/users'],
  ['resident', () => resident, 'GET', '/api/admin/audit'],
  ['resident', () => resident, 'POST', '/api/centres'],

  ['flood officer', () => officer, 'GET', '/api/admin/users'],
  ['flood officer', () => officer, 'GET', '/api/admin/audit'],
  ['flood officer', () => officer, 'POST', '/api/centres'],
  ['flood officer', () => officer, 'GET', '/api/reports/mine'],

  ['evacuation officer', () => evacuation, 'GET', '/api/officer/reports'],
  ['evacuation officer', () => evacuation, 'GET', '/api/officer/dashboard'],
  ['evacuation officer', () => evacuation, 'POST', '/api/officer/alerts'],
  ['evacuation officer', () => evacuation, 'GET', '/api/admin/users'],

  // Administrators govern the platform; they never make operational flood
  // decisions such as verifying a report or publishing an alert.
  ['administrator', () => admin, 'GET', '/api/officer/reports'],
  ['administrator', () => admin, 'GET', '/api/officer/alerts'],
  ['administrator', () => admin, 'POST', '/api/officer/alerts'],
  ['administrator', () => admin, 'GET', '/api/officer/dashboard'],
  ['administrator', () => admin, 'POST', '/api/centres'],
  ['administrator', () => admin, 'GET', '/api/reports/mine']
];

for (const [role, clientFactory, method, path] of FORBIDDEN) {
  test(`${role} is refused ${method} ${path}`, async () => {
    const result = await request(clientFactory(), method, path, method === 'POST' ? {} : undefined);

    assert.equal(result.status, 403, `expected 403 but received ${result.status}`);
    assert.equal(result.body.error.code, 'FORBIDDEN');
  });
}

const UNAUTHENTICATED = [
  ['GET', '/api/officer/reports'],
  ['GET', '/api/admin/users'],
  ['GET', '/api/centres'],
  ['GET', '/api/reports/mine'],
  ['POST', '/api/officer/alerts']
];

for (const [method, path] of UNAUTHENTICATED) {
  test(`anonymous access to ${method} ${path} returns 401`, async () => {
    const result = await request(createClient(), method, path, method === 'POST' ? {} : undefined);
    assert.equal(result.status, 401);
  });
}

test('every signed-in role may read evacuation centre information', async () => {
  for (const client of [resident, officer, evacuation, admin]) {
    const result = await request(client, 'GET', '/api/centres');
    assert.equal(result.status, 200);
  }
});

test('public information endpoints need no authentication', async () => {
  for (const path of ['/api/public/zones', '/api/public/alerts', '/api/public/incidents', '/api/public/centres']) {
    const result = await request(createClient(), 'GET', path);
    assert.equal(result.status, 200, `${path} should be public`);
  }
});

test('a deactivated account is refused access even with a valid token', async () => {
  const victim = await signIn('resident2@test.local');

  const beforeDeactivation = await request(victim, 'GET', '/api/auth/me');
  assert.equal(beforeDeactivation.status, 200);

  const deactivated = await request(admin, 'PATCH', `/api/admin/users/${victim.user.id}/status`, {
    status: 'INACTIVE'
  });
  assert.equal(deactivated.status, 200);

  // The access token is still cryptographically valid, so this proves the
  // account status is re-checked on every authenticated request.
  const afterDeactivation = await request(victim, 'GET', '/api/auth/me');
  assert.equal(afterDeactivation.status, 401);
  assert.equal(afterDeactivation.body.error.code, 'ACCOUNT_INACTIVE');

  await request(admin, 'PATCH', `/api/admin/users/${victim.user.id}/status`, { status: 'ACTIVE' });
});
