/**
 * Password change and administrator reset.
 *
 * These live in their own file rather than in auth.test.js because the change
 * route shares the authentication rate limiter, and the limiter budget is per
 * process. A separate file keeps both suites comfortably inside it.
 */
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

const NEW_PASSWORD = 'ChangedPass1';

let admin;

test.before(async () => {
  await startServer();
  await resetDatabase();
  admin = await signIn('admin@test.local');
});

test.after(async () => {
  await stopServer();
});

async function findUserId(email) {
  const result = await request(admin, 'GET', `/api/admin/users?search=${encodeURIComponent(email)}&limit=10`);
  const user = result.body.data.users.find((candidate) => candidate.email === email);
  assert.ok(user, `expected to find ${email}`);
  return user.id;
}

test('a resident can change their own password and sign in with the new one', async () => {
  const resident = await signIn('resident@test.local');

  const changed = await request(resident, 'PATCH', '/api/auth/me/password', {
    currentPassword: TEST_PASSWORD,
    newPassword: NEW_PASSWORD
  });
  assert.equal(changed.status, 200);

  const reSignedIn = await signIn('resident@test.local', NEW_PASSWORD);
  assert.equal(reSignedIn.user.email, 'resident@test.local');

  const withOldPassword = await request(createClient(), 'POST', '/api/auth/login', {
    email: 'resident@test.local',
    password: TEST_PASSWORD
  });
  assert.equal(withOldPassword.status, 401, 'the previous password must stop working');
});

test('an incorrect current password is refused', async () => {
  const resident = await signIn('resident2@test.local');

  const result = await request(resident, 'PATCH', '/api/auth/me/password', {
    currentPassword: 'NotMyPassword1',
    newPassword: NEW_PASSWORD
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'INVALID_CREDENTIALS');

  // The account must be untouched after a failed attempt.
  const stillWorks = await request(createClient(), 'POST', '/api/auth/login', {
    email: 'resident2@test.local',
    password: TEST_PASSWORD
  });
  assert.equal(stillWorks.status, 200);
});

test('a weak or unchanged new password is refused', async () => {
  const resident = await signIn('resident2@test.local');

  const weak = await request(resident, 'PATCH', '/api/auth/me/password', {
    currentPassword: TEST_PASSWORD,
    newPassword: 'weak'
  });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.error.code, 'VALIDATION_ERROR');

  const unchanged = await request(resident, 'PATCH', '/api/auth/me/password', {
    currentPassword: TEST_PASSWORD,
    newPassword: TEST_PASSWORD
  });
  assert.equal(unchanged.status, 400);
  assert.equal(unchanged.body.error.code, 'VALIDATION_ERROR');
});

test('changing a password ends other sessions but keeps the current one', async () => {
  const firstDevice = await signIn('officer@test.local');
  const secondDevice = await signIn('officer@test.local');

  const changed = await request(firstDevice, 'PATCH', '/api/auth/me/password', {
    currentPassword: TEST_PASSWORD,
    newPassword: NEW_PASSWORD
  });
  assert.equal(changed.status, 200);

  const otherDevice = await request(secondDevice, 'POST', '/api/auth/refresh');
  assert.equal(otherDevice.status, 401, 'the other device must be signed out');

  const sameDevice = await request(firstDevice, 'POST', '/api/auth/refresh');
  assert.equal(sameDevice.status, 200, 'the device that made the change stays signed in');
});

test('an administrator can reset another account password', async () => {
  const targetId = await findUserId('evacuation@test.local');
  const targetBefore = await signIn('evacuation@test.local');

  const reset = await request(admin, 'POST', `/api/admin/users/${targetId}/password-reset`, {
    newPassword: NEW_PASSWORD
  });
  assert.equal(reset.status, 200);

  const signedOut = await request(targetBefore, 'POST', '/api/auth/refresh');
  assert.equal(signedOut.status, 401, 'a reset must sign the account out everywhere');

  const withNewPassword = await signIn('evacuation@test.local', NEW_PASSWORD);
  assert.equal(withNewPassword.user.role.code, 'EVACUATION_OFFICER');
});

test('an administrator cannot reset their own password', async () => {
  const adminId = await findUserId('admin@test.local');

  const result = await request(admin, 'POST', `/api/admin/users/${adminId}/password-reset`, {
    newPassword: NEW_PASSWORD
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'SELF_PASSWORD_RESET_FORBIDDEN');
});

test('a reset rejects a weak password and an unknown account', async () => {
  const targetId = await findUserId('officer@test.local');

  const weak = await request(admin, 'POST', `/api/admin/users/${targetId}/password-reset`, {
    newPassword: 'short'
  });
  assert.equal(weak.status, 400);

  const missing = await request(
    admin,
    'POST',
    '/api/admin/users/11111111-1111-4111-8111-111111111111/password-reset',
    { newPassword: NEW_PASSWORD }
  );
  assert.equal(missing.status, 404);
});

test('password changes and resets are recorded in the audit trail', async () => {
  const audit = await request(admin, 'GET', '/api/admin/audit?limit=100');
  assert.equal(audit.status, 200);

  const actions = audit.body.data.entries.map((entry) => entry.action);
  assert.ok(actions.includes('USER_PASSWORD_CHANGED'), 'a self-service change must be audited');
  assert.ok(actions.includes('USER_PASSWORD_RESET'), 'an administrator reset must be audited');
});

test('a resident cannot reset anyone password', async () => {
  const resident = await signIn('resident@test.local', NEW_PASSWORD);
  const targetId = await findUserId('officer@test.local');

  const result = await request(resident, 'POST', `/api/admin/users/${targetId}/password-reset`, {
    newPassword: 'AnotherPass1'
  });

  assert.equal(result.status, 403);
});
