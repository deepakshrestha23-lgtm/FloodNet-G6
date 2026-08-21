const assert = require('node:assert/strict');
const test = require('node:test');
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
let admin;
let wards;

test.before(async () => {
  await startServer();
  await resetDatabase();
  resident = await signIn('resident@test.local');
  officer = await signIn('officer@test.local');
  admin = await signIn('admin@test.local');

  const provinces = await request(createClient(), 'GET', '/api/geography/provinces');
  const districts = await request(createClient(), 'GET', `/api/geography/districts?provinceId=${provinces.body.data.provinces[0].id}`);
  const localLevels = await request(createClient(), 'GET', `/api/geography/local-levels?districtId=${districts.body.data.districts[0].id}`);
  const wardResult = await request(createClient(), 'GET', `/api/geography/wards?localLevelId=${localLevels.body.data.localLevels[0].id}`);
  wards = wardResult.body.data.wards;
});

test.after(async () => {
  await stopServer();
});

test('the public geography API exposes the configured administrative hierarchy', async () => {
  const provinces = await request(createClient(), 'GET', '/api/geography/provinces');
  assert.equal(provinces.status, 200);
  // The test harness intentionally uses a small deterministic fixture. The
  // production seed loads all 7 provinces, 77 districts, 753 local levels,
  // and 6,743 wards from server/db/seeds/data/nepal-geography.json.
  assert.equal(provinces.body.data.provinces.length, 1);

  const districts = await request(createClient(), 'GET', `/api/geography/districts?provinceId=${provinces.body.data.provinces[0].id}`);
  assert.ok(districts.body.data.districts.length > 0);
  assert.equal(districts.body.data.districts[0].province.id, provinces.body.data.provinces[0].id);
  assert.equal(wards.length, 2);
});

test('a resident can submit a report using an administrative ward without a flood zone', async () => {
  const result = await request(resident, 'POST', '/api/reports', {
    wardId: wards[0].id,
    locality: 'Test Tole',
    nearestLandmark: 'Community bridge',
    latitude: 27.7172,
    longitude: 85.324,
    floodType: 'URBAN_DRAINAGE',
    peopleAtRisk: 12,
    locationDescription: 'Water is entering the lower lane near the bridge',
    observedSeverity: 'HIGH',
    roadCondition: 'RESTRICTED',
    incidentDescription: 'Water is rising around the homes and the lane is difficult to cross.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.data.report.zone, null);
  assert.equal(result.body.data.report.geography.ward.id, wards[0].id);
  assert.equal(result.body.data.report.peopleAtRisk, 12);
});

test('an officer jurisdiction prevents cross-ward report access and review', async () => {
  const first = await request(resident, 'POST', '/api/reports', {
    wardId: wards[0].id,
    locationDescription: 'First jurisdiction lane',
    observedSeverity: 'MODERATE',
    roadCondition: 'CLEAR',
    incidentDescription: 'Water is pooling beside the lane.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });
  const second = await request(resident, 'POST', '/api/reports', {
    wardId: wards[1].id,
    locationDescription: 'Second jurisdiction lane',
    observedSeverity: 'MODERATE',
    roadCondition: 'CLEAR',
    incidentDescription: 'Water is pooling beside the lane.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });

  const assignment = await request(admin, 'PATCH', `/api/admin/users/${officer.user.id}/jurisdiction`, {
    scopeLevel: 'WARD',
    wardId: wards[0].id
  });
  assert.equal(assignment.status, 200);

  const queue = await request(officer, 'GET', '/api/officer/reports?limit=100');
  assert.equal(queue.status, 200);
  assert.ok(queue.body.data.reports.some((report) => report.id === first.body.data.report.id));
  assert.ok(!queue.body.data.reports.some((report) => report.id === second.body.data.report.id));

  const wardQueue = await request(officer, 'GET', `/api/officer/reports?wardId=${wards[0].id}`);
  assert.equal(wardQueue.status, 200);
  assert.ok(wardQueue.body.data.reports.every((report) => report.geography.ward.id === wards[0].id));

  const dashboard = await request(officer, 'GET', `/api/officer/dashboard?wardId=${wards[0].id}`);
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.body.data.summary.totalReports >= 1);

  const invalidFilter = await request(officer, 'GET', '/api/officer/dashboard?wardId=not-a-uuid');
  assert.equal(invalidFilter.status, 400);

  const hidden = await request(officer, 'GET', `/api/officer/reports/${second.body.data.report.id}`);
  assert.equal(hidden.status, 404);
});
