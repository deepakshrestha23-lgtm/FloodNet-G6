const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer,
  stopServer,
  resetDatabase,
  createClient,
  request,
  signIn,
  getZones,
  createReport
} = require('./helpers/harness');

let admin;
let resident;
let officer;
let evacuation;
let zones;
let defaultWardId;

test.before(async () => {
  await startServer();
  await resetDatabase();

  admin = await signIn('admin@test.local');
  resident = await signIn('resident@test.local');
  officer = await signIn('officer@test.local');
  evacuation = await signIn('evacuation@test.local');
  zones = await getZones();

  const { pool } = require('../server/db/pool');
  const wardResult = await pool.query(
    `SELECT ward_id FROM flood_zone_wards
     WHERE zone_id = $1
     ORDER BY is_primary DESC, ward_id
     LIMIT 1`,
    [zones[0].id]
  );
  defaultWardId = wardResult.rows[0].ward_id;
});

test.after(async () => {
  await stopServer();
});

test('an administrator can list, search and filter users', async () => {
  const all = await request(admin, 'GET', '/api/admin/users?limit=100');
  assert.equal(all.status, 200);
  assert.ok(all.body.data.users.length >= 5);

  const searched = await request(admin, 'GET', '/api/admin/users?search=officer');
  assert.ok(searched.body.data.users.length >= 1);

  const byRole = await request(admin, 'GET', '/api/admin/users?role=RESIDENT&limit=100');
  assert.ok(byRole.body.data.users.every((user) => user.role.code === 'RESIDENT'));
});

test('administrative user listings never expose password material', async () => {
  const result = await request(admin, 'GET', '/api/admin/users?limit=100');
  assert.ok(!JSON.stringify(result.body).toLowerCase().includes('password'));
});

test('an administrator can create an authorised staff account', async () => {
  const email = `staff-${Date.now()}@test.local`;

  const created = await request(admin, 'POST', '/api/admin/users', {
    email,
    password: 'StaffPassw0rd',
    roleCode: 'FLOOD_MONITORING_OFFICER',
    firstName: 'New',
    lastName: 'Officer'
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.data.user.role.code, 'FLOOD_MONITORING_OFFICER');

  const signedIn = await signIn(email, 'StaffPassw0rd');
  assert.equal(signedIn.user.role.code, 'FLOOD_MONITORING_OFFICER');
});

test('a duplicate email is refused when creating an account', async () => {
  const result = await request(admin, 'POST', '/api/admin/users', {
    email: 'resident@test.local',
    password: 'StaffPassw0rd',
    roleCode: 'RESIDENT',
    firstName: 'Duplicate',
    lastName: 'Account'
  });

  assert.equal(result.status, 409);
});

test('an unknown role cannot be assigned', async () => {
  const result = await request(admin, 'POST', '/api/admin/users', {
    email: `role-${Date.now()}@test.local`,
    password: 'StaffPassw0rd',
    roleCode: 'SUPERUSER',
    firstName: 'Bad',
    lastName: 'Role'
  });

  assert.equal(result.status, 400);
});

test('an administrator cannot deactivate their own account', async () => {
  const result = await request(admin, 'PATCH', `/api/admin/users/${admin.user.id}/status`, {
    status: 'INACTIVE'
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'SELF_DEACTIVATION_FORBIDDEN');
});

test('an administrator cannot change their own role', async () => {
  const result = await request(admin, 'PATCH', `/api/admin/users/${admin.user.id}/role`, {
    roleCode: 'RESIDENT'
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'SELF_ROLE_CHANGE_FORBIDDEN');
});

test('the last active administrator is protected from deactivation', async () => {
  const secondAdminEmail = `admin2-${Date.now()}@test.local`;

  const created = await request(admin, 'POST', '/api/admin/users', {
    email: secondAdminEmail,
    password: 'AdminPassw0rd',
    roleCode: 'ADMINISTRATOR',
    firstName: 'Second',
    lastName: 'Admin'
  });
  assert.equal(created.status, 201);

  const secondAdmin = await signIn(secondAdminEmail, 'AdminPassw0rd');

  // With two administrators, deactivating one is allowed.
  const deactivateFirst = await request(secondAdmin, 'PATCH', `/api/admin/users/${admin.user.id}/status`, {
    status: 'INACTIVE'
  });
  assert.equal(deactivateFirst.status, 200);

  // The remaining administrator cannot remove the last administrative access.
  const deactivateSelf = await request(secondAdmin, 'PATCH', `/api/admin/users/${secondAdmin.user.id}/status`, {
    status: 'INACTIVE'
  });
  assert.equal(deactivateSelf.status, 409);

  const demoteSelf = await request(secondAdmin, 'PATCH', `/api/admin/users/${secondAdmin.user.id}/role`, {
    roleCode: 'RESIDENT'
  });
  assert.equal(demoteSelf.status, 409);

  // Restore the original administrator so later tests are unaffected.
  await request(secondAdmin, 'PATCH', `/api/admin/users/${admin.user.id}/status`, { status: 'ACTIVE' });
  admin = await signIn('admin@test.local');
});

test('changing a role revokes the affected sessions', async () => {
  const email = `rotate-${Date.now()}@test.local`;

  await request(admin, 'POST', '/api/admin/users', {
    email,
    password: 'RotatePassw0rd',
    roleCode: 'RESIDENT',
    firstName: 'Rotate',
    lastName: 'User'
  });

  const victim = await signIn(email, 'RotatePassw0rd');
  const before = await request(victim, 'POST', '/api/auth/refresh');
  assert.equal(before.status, 200);

  const users = await request(admin, 'GET', `/api/admin/users?search=${encodeURIComponent(email)}`);
  const victimId = users.body.data.users[0].id;

  const changed = await request(admin, 'PATCH', `/api/admin/users/${victimId}/role`, {
    roleCode: 'EVACUATION_OFFICER'
  });
  assert.equal(changed.status, 200);

  const after = await request(victim, 'POST', '/api/auth/refresh');
  assert.equal(after.status, 401, 'the old session must not survive a role change');
});

test('an administrator can create and update flood zones', async () => {
  const code = `ZONE-T${Date.now() % 100000}`;

  const created = await request(admin, 'POST', '/api/admin/zones', {
    code,
    name: 'Test Zone',
    locality: 'Test District',
    zoneType: 'RIVER_CORRIDOR',
    description: 'Created by the automated test suite'
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.zone.zoneType, 'RIVER_CORRIDOR');

  const zoneId = created.body.data.zone.id;

  const updated = await request(admin, 'PATCH', `/api/admin/zones/${zoneId}`, {
    name: 'Renamed Test Zone',
    locality: 'Test District',
    zoneType: 'FLOODPLAIN',
    isActive: true
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.zone.name, 'Renamed Test Zone');
  assert.equal(updated.body.data.zone.zoneType, 'FLOODPLAIN');
});

test('a zone code is unique and cannot be changed after creation', async () => {
  const duplicate = await request(admin, 'POST', '/api/admin/zones', {
    code: 'ZONE-A',
    name: 'Duplicate code',
    locality: 'Test'
  });
  assert.equal(duplicate.status, 409);

  const zoneList = await request(admin, 'GET', '/api/admin/zones');
  const existing = zoneList.body.data.zones.find((zone) => zone.code === 'ZONE-A');

  const renameCode = await request(admin, 'PATCH', `/api/admin/zones/${existing.id}`, {
    code: 'ZONE-RENAMED',
    name: 'Riverbank North',
    isActive: true
  });
  assert.equal(renameCode.status, 400, 'a zone code is permanent identity');
});

test('a deactivated zone disappears from public listings and blocks new reports', async () => {
  const code = `ZONE-D${Date.now() % 100000}`;

  const created = await request(admin, 'POST', '/api/admin/zones', {
    code,
    name: 'Zone To Deactivate',
    locality: 'Test District'
  });
  const zoneId = created.body.data.zone.id;

  const deactivated = await request(admin, 'PATCH', `/api/admin/zones/${zoneId}`, {
    name: 'Zone To Deactivate',
    locality: 'Test District',
    isActive: false
  });
  assert.equal(deactivated.status, 200);

  const publicZones = await request(createClient(), 'GET', '/api/public/zones');
  assert.ok(!publicZones.body.data.zones.some((zone) => zone.id === zoneId));

  const report = await request(resident, 'POST', '/api/reports', {
    zoneId,
    wardId: defaultWardId,
    locationDescription: 'Report in an inactive zone',
    observedSeverity: 'HIGH',
    roadCondition: 'BLOCKED',
    incidentDescription: 'This must be refused.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });
  assert.equal(report.status, 400);
});

test('a zone with active centres cannot be deactivated', async () => {
  const created = await request(evacuation, 'POST', '/api/centres', {
    zoneId: zones[1].id,
    wardId: defaultWardId,
    name: `Zone Guard Centre ${Date.now()}`,
    locationDescription: 'Centre that blocks zone deactivation',
    maximumCapacity: 50,
    facilities: []
  });
  assert.equal(created.status, 201);

  const result = await request(admin, 'PATCH', `/api/admin/zones/${zones[1].id}`, {
    name: 'Central Lowlands',
    locality: 'Central District',
    isActive: false
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'ZONE_HAS_ACTIVE_CENTRES');
});

test('an administrator can manage facility master data', async () => {
  const code = `TEST_FACILITY_${Date.now() % 100000}`;

  const created = await request(admin, 'POST', '/api/admin/facility-types', {
    code,
    displayName: 'Test facility'
  });
  assert.equal(created.status, 200);

  const facilityId = created.body.data.facilityType.id;

  const retired = await request(admin, 'POST', '/api/admin/facility-types', {
    facilityTypeId: facilityId,
    displayName: 'Test facility',
    isActive: false
  });
  assert.equal(retired.status, 200);
  assert.equal(retired.body.data.facilityType.isActive, false);

  // A retired type must no longer be offered when configuring a centre.
  const active = await request(evacuation, 'GET', '/api/centres/facility-types');
  assert.ok(!active.body.data.facilityTypes.some((type) => type.id === facilityId));
});

/**
 * Auditing is the administrator's evidence that the platform is being operated
 * correctly, so the trail must capture actions from every module.
 */
test('the audit trail records state changes from every module', async () => {
  const report = await createReport(resident, zones[0].id);
  await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, { action: 'VERIFY' });

  const audit = await request(admin, 'GET', '/api/admin/audit?limit=100');
  assert.equal(audit.status, 200);

  const actions = audit.body.data.entries.map((entry) => entry.action);

  for (const expected of ['REPORT_SUBMITTED', 'REPORT_VERIFY', 'CENTRE_CREATED', 'USER_CREATED', 'ZONE_CREATED']) {
    assert.ok(actions.includes(expected), `audit trail should contain ${expected}`);
  }
});

test('audit entries identify the actor and can be filtered', async () => {
  const filtered = await request(admin, 'GET', '/api/admin/audit?entityType=FLOOD_REPORT&limit=100');
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.data.entries.every((entry) => entry.entityType === 'FLOOD_REPORT'));

  const withActor = filtered.body.data.entries.find((entry) => entry.actor);
  assert.ok(withActor, 'audit entries should identify who performed the action');
  assert.ok(withActor.actor.role);

  const actions = await request(admin, 'GET', '/api/admin/audit/actions');
  assert.ok(actions.body.data.actions.length > 0);
});

test('the administration overview reports real counts', async () => {
  const overview = await request(admin, 'GET', '/api/admin/overview');

  assert.equal(overview.status, 200);
  assert.ok(overview.body.data.summary.totalUsers >= 5);
  assert.equal(
    overview.body.data.usersByRole.reduce((total, row) => total + row.total, 0),
    overview.body.data.summary.totalUsers,
    'the role breakdown must account for every user'
  );
});
