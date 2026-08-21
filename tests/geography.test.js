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
let evacuation;
let admin;
let wards;

test.before(async () => {
  await startServer();
  await resetDatabase();
  resident = await signIn('resident@test.local');
  officer = await signIn('officer@test.local');
  evacuation = await signIn('evacuation@test.local');
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

test('a new report cannot use an operational risk area as its only location', async () => {
  const zones = await request(createClient(), 'GET', '/api/public/zones');
  const result = await request(resident, 'POST', '/api/reports', {
    zoneId: zones.body.data.zones[0].id,
    locationDescription: 'A risk area without an official ward',
    observedSeverity: 'HIGH',
    roadCondition: 'RESTRICTED',
    incidentDescription: 'This submission must be linked to Nepal administrative geography.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });

  assert.equal(result.status, 400);
  assert.ok(result.body.error.details.includes('An administrative ward is required'));
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

test('monitoring and evacuation officers cannot write outside their assigned ward', async () => {
  for (const user of [officer, evacuation]) {
    const assignment = await request(admin, 'PATCH', `/api/admin/users/${user.user.id}/jurisdiction`, {
      scopeLevel: 'WARD',
      wardId: wards[0].id
    });
    assert.equal(assignment.status, 200);
  }

  const alertPayload = (wardId) => ({
    title: 'Jurisdiction boundary warning',
    severity: 'WARNING',
    warningDescription: 'Water levels require a focused local warning.',
    recommendedActions: 'Avoid the affected road and follow official instructions.',
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    zoneIds: [],
    wardIds: [wardId]
  });

  const alertOutside = await request(officer, 'POST', '/api/officer/alerts', alertPayload(wards[1].id));
  assert.equal(alertOutside.status, 403);
  assert.equal(alertOutside.body.error.code, 'JURISDICTION_FORBIDDEN');

  const alertInside = await request(officer, 'POST', '/api/officer/alerts', alertPayload(wards[0].id));
  assert.equal(alertInside.status, 201);

  const centrePayload = (wardId, name) => ({
    wardId,
    name,
    locationDescription: 'Jurisdiction test centre location',
    maximumCapacity: 50,
    facilities: []
  });

  const centreOutside = await request(
    evacuation,
    'POST',
    '/api/centres',
    centrePayload(wards[1].id, 'Outside Jurisdiction Centre')
  );
  assert.equal(centreOutside.status, 403);
  assert.equal(centreOutside.body.error.code, 'JURISDICTION_FORBIDDEN');

  const centreInside = await request(
    evacuation,
    'POST',
    '/api/centres',
    centrePayload(wards[0].id, 'Inside Jurisdiction Centre')
  );
  assert.equal(centreInside.status, 201);
});

test('an evacuation officer sees verified incidents only inside their jurisdiction', async () => {
  const nationalOfficer = await request(admin, 'PATCH', `/api/admin/users/${officer.user.id}/jurisdiction`, {
    scopeLevel: 'NATIONAL'
  });
  assert.equal(nationalOfficer.status, 200);

  const createIncident = async (wardId, locationDescription) => {
    const created = await request(resident, 'POST', '/api/reports', {
      wardId,
      locationDescription,
      observedSeverity: 'HIGH',
      roadCondition: 'RESTRICTED',
      incidentDescription: 'A jurisdiction-scoped verified incident for evacuation planning.',
      observedAt: new Date(Date.now() - 3600_000).toISOString()
    });
    assert.equal(created.status, 201);

    const verified = await request(
      officer,
      'POST',
      `/api/officer/reports/${created.body.data.report.id}/review`,
      { action: 'VERIFY' }
    );
    assert.equal(verified.status, 200);
    return created.body.data.report.reportReference;
  };

  const insideReference = await createIncident(wards[0].id, 'Inside evacuation jurisdiction');
  const outsideReference = await createIncident(wards[1].id, 'Outside evacuation jurisdiction');

  const assignment = await request(admin, 'PATCH', `/api/admin/users/${evacuation.user.id}/jurisdiction`, {
    scopeLevel: 'WARD',
    wardId: wards[0].id
  });
  assert.equal(assignment.status, 200);

  const result = await request(evacuation, 'GET', '/api/centres/incidents');
  assert.equal(result.status, 200);
  const references = result.body.data.incidents.map((incident) => incident.reportReference);
  assert.ok(references.includes(insideReference));
  assert.ok(!references.includes(outsideReference));
  assert.ok(!JSON.stringify(result.body).includes('resident@test.local'), 'evacuation incident data must not expose reporter identity');

  const residentResult = await request(resident, 'GET', '/api/centres/incidents');
  assert.equal(residentResult.status, 403);
});
