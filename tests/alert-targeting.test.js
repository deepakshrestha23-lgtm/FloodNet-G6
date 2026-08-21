/**
 * Targeting an alert at an area rather than at individual wards.
 *
 * An officer warning a district previously had to name every ward inside it.
 * Under pressure nobody does that, so they would target a handful and everyone
 * else silently received nothing. Coarse selections are expanded at save time
 * into the definite ward set the alert is stored against.
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
let geography;

function alertBody(targets) {
  return {
    title: 'Area targeting check',
    severity: 'WARNING',
    warningDescription: 'Levels are rising across the affected area.',
    recommendedActions: 'Move valuables above expected water levels and be ready to leave.',
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
    zoneIds: [],
    wardIds: [],
    ...targets
  };
}

test.before(async () => {
  await startServer();
  await resetDatabase();
  officer = await signIn('officer@test.local');

  const anonymous = createClient();
  const provinces = await request(anonymous, 'GET', '/api/geography/provinces');
  const province = provinces.body.data.provinces[0];
  const districts = await request(anonymous, 'GET', `/api/geography/districts?provinceId=${province.id}`);
  const district = districts.body.data.districts[0];
  const localLevels = await request(anonymous, 'GET', `/api/geography/local-levels?districtId=${district.id}`);
  const localLevel = localLevels.body.data.localLevels[0];
  const wards = await request(anonymous, 'GET', `/api/geography/wards?localLevelId=${localLevel.id}`);

  geography = { province, district, localLevel, wards: wards.body.data.wards };
});

test.after(async () => {
  await stopServer();
});

test('targeting a district reaches every ward inside it, not just one', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    districtIds: [geography.district.id]
  }));

  assert.equal(created.status, 201, JSON.stringify(created.body));
  const alert = created.body.data.alert;

  assert.ok(
    alert.wards.length >= geography.wards.length,
    `a district must expand to at least its municipality's wards, got ${alert.wards.length}`
  );

  const targetedIds = alert.wards.map((w) => w.id);
  for (const ward of geography.wards) {
    assert.ok(targetedIds.includes(ward.id), `ward ${ward.name} must be covered by its district`);
  }
});

test('a resident in any ward of the district sees a district-wide alert', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    districtIds: [geography.district.id]
  }));
  const alertId = created.body.data.alert.id;
  await request(officer, 'POST', `/api/officer/alerts/${alertId}/publish`);

  // The exact case that failed before: two different wards of one municipality.
  for (const ward of geography.wards.slice(0, 2)) {
    const seen = await request(createClient(), 'GET', `/api/public/alerts?wardId=${ward.id}`);
    assert.ok(
      seen.body.data.alerts.some((a) => a.id === alertId),
      `a resident in ${ward.name} must receive the district-wide alert`
    );
  }
});

test('targeting a municipality reaches its wards and stops there', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    localLevelIds: [geography.localLevel.id]
  }));

  assert.equal(created.status, 201);
  const targetedIds = created.body.data.alert.wards.map((w) => w.id);

  for (const ward of geography.wards) {
    assert.ok(targetedIds.includes(ward.id), 'every ward of the municipality must be covered');
  }
  assert.equal(
    targetedIds.length,
    geography.wards.length,
    'a municipality must not pull in wards from elsewhere'
  );
});

test('a province selection resolves through the whole hierarchy', async () => {
  const byProvince = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    provinceIds: [geography.province.id]
  }));
  assert.equal(byProvince.status, 201, JSON.stringify(byProvince.body));

  const byDistrict = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    districtIds: [geography.district.id]
  }));

  const provinceWards = byProvince.body.data.alert.wards.map((w) => w.id).sort();
  const districtWards = byDistrict.body.data.alert.wards.map((w) => w.id).sort();

  // The harness seeds a single district inside the province, so a province
  // selection must cover at least everything the district covers.
  assert.ok(provinceWards.length >= districtWards.length);
  for (const wardId of districtWards) {
    assert.ok(provinceWards.includes(wardId), 'a province must include its districts wards');
  }
  for (const ward of geography.wards) {
    assert.ok(provinceWards.includes(ward.id), 'expansion must reach individual wards');
  }
});

test('coarse and precise targets combine without duplicating a ward', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    districtIds: [geography.district.id],
    wardIds: [geography.wards[0].id]
  }));

  assert.equal(created.status, 201);
  const ids = created.body.data.alert.wards.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'a ward must not be stored twice');
});

test('an alert with no area at all is refused', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({}));

  assert.equal(created.status, 400);
  assert.equal(created.body.error.code, 'VALIDATION_ERROR');
});

test('an unknown area identifier is refused', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    districtIds: ['not-a-uuid']
  }));
  assert.equal(created.status, 400);

  // A well-formed identifier that matches nothing resolves to no wards, which
  // would produce an alert reaching nobody rather than an obvious failure.
  const empty = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    districtIds: ['11111111-1111-4111-8111-111111111111']
  }));
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'ALERT_TARGETS_EMPTY');
});

test('editing an alert re-expands its areas', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    localLevelIds: [geography.localLevel.id]
  }));
  const alertId = created.body.data.alert.id;
  const before = created.body.data.alert.wards.length;

  const updated = await request(officer, 'PATCH', `/api/officer/alerts/${alertId}`, alertBody({
    districtIds: [geography.district.id]
  }));

  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.ok(
    updated.body.data.alert.wards.length >= before,
    'widening from a municipality to its district must widen the stored ward set'
  );
});

test('editing an alert without changing areas preserves every ward', async () => {
  const created = await request(officer, 'POST', '/api/officer/alerts', alertBody({
    districtIds: [geography.district.id]
  }));
  const alert = created.body.data.alert;
  const originalWards = alert.wards.map((w) => w.id).sort();

  // Resubmitting the resolved wards, which is what the edit form now sends,
  // must leave the alert covering exactly the same places.
  const updated = await request(officer, 'PATCH', `/api/officer/alerts/${alert.id}`, alertBody({
    wardIds: originalWards
  }));

  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.deepEqual(
    updated.body.data.alert.wards.map((w) => w.id).sort(),
    originalWards,
    'an edit must not silently narrow who an alert reaches'
  );
});
