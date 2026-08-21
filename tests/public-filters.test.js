/**
 * Administrative filtering on the public surface.
 *
 * Filtering used to require either an operational zone, which the public has
 * no way to know, or one exact ward. Somebody looking for shelter thinks in
 * districts and municipalities, so every level has to filter on its own.
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

let evacuation;
let zones;
let geography;

test.before(async () => {
  await startServer();
  await resetDatabase();
  evacuation = await signIn('evacuation@test.local');
  zones = await getZones();

  const anonymous = createClient();
  const provinces = await request(anonymous, 'GET', '/api/geography/provinces');
  const province = provinces.body.data.provinces[0];
  const districts = await request(anonymous, 'GET', `/api/geography/districts?provinceId=${province.id}`);
  const district = districts.body.data.districts[0];
  const localLevels = await request(anonymous, 'GET', `/api/geography/local-levels?districtId=${district.id}`);
  const localLevel = localLevels.body.data.localLevels[0];
  const wards = await request(anonymous, 'GET', `/api/geography/wards?localLevelId=${localLevel.id}`);

  geography = { province, district, localLevel, wards: wards.body.data.wards };

  // A centre located by ward, so administrative filtering has something to find.
  const created = await request(evacuation, 'POST', '/api/centres', {
    wardId: geography.wards[0].id,
    name: 'District Filter Shelter',
    locationDescription: 'Located by ward so it can be found by district',
    maximumCapacity: 120,
    facilities: []
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
});

test.after(async () => {
  await stopServer();
});

test('a centre can be found by province, district and municipality, not only by exact ward', async () => {
  const anonymous = createClient();

  for (const [label, query] of [
    ['province', `provinceId=${geography.province.id}`],
    ['district', `districtId=${geography.district.id}`],
    ['municipality', `localLevelId=${geography.localLevel.id}`],
    ['ward', `wardId=${geography.wards[0].id}`]
  ]) {
    const result = await request(anonymous, 'GET', `/api/public/centres?${query}`);
    assert.equal(result.status, 200, `${label} filter should succeed`);
    assert.ok(
      result.body.data.centres.some((c) => c.name === 'District Filter Shelter'),
      `filtering by ${label} must find the centre`
    );
  }
});

test('an unrelated ward in the same municipality does not match a ward filter', async () => {
  const other = geography.wards[1];
  if (!other) return;

  const result = await request(createClient(), 'GET', `/api/public/centres?wardId=${other.id}`);
  assert.equal(result.status, 200);
  assert.ok(
    !result.body.data.centres.some((c) => c.name === 'District Filter Shelter'),
    'a ward filter must stay precise even though wider levels are supported'
  );
});

test('the response reports the unfiltered total alongside the filtered list', async () => {
  const filtered = await request(createClient(), 'GET', `/api/public/centres?districtId=${geography.district.id}`);
  const everything = await request(createClient(), 'GET', '/api/public/centres');

  assert.equal(filtered.body.data.totalActive, everything.body.data.centres.length);
  assert.ok(
    filtered.body.data.centres.length <= filtered.body.data.totalActive,
    'a filtered view can never claim more than exists'
  );
});

test('alerts and incidents accept the same administrative filters', async () => {
  const anonymous = createClient();

  const alerts = await request(anonymous, 'GET', `/api/public/alerts?districtId=${geography.district.id}`);
  assert.equal(alerts.status, 200);
  assert.ok(Array.isArray(alerts.body.data.alerts));
  assert.equal(typeof alerts.body.data.totalActive, 'number');

  const incidents = await request(anonymous, 'GET', `/api/public/incidents?districtId=${geography.district.id}&limit=5`);
  assert.equal(incidents.status, 200);
  assert.ok(Array.isArray(incidents.body.data.incidents));
});

test('an invalid administrative filter is rejected rather than ignored', async () => {
  const anonymous = createClient();

  for (const query of ['provinceId=not-a-uuid', 'districtId=123', 'localLevelId=abc']) {
    const result = await request(anonymous, 'GET', `/api/public/centres?${query}`);
    assert.equal(result.status, 400, `expected 400 for ${query}`);
  }
});

test('combining a location with an operational zone narrows to both', async () => {
  /*
   * The centre sits on ward 1, which the harness maps to ZONE-A. Asking for
   * ZONE-B and the right district must therefore exclude it: both conditions
   * have to hold, rather than either one being enough on its own.
   */
  const zoneB = zones.find((z) => z.code === 'ZONE-B');

  const excluded = await request(
    createClient(),
    'GET',
    `/api/public/centres?zoneId=${zoneB.id}&districtId=${geography.district.id}`
  );
  assert.equal(excluded.status, 200);
  assert.ok(
    !excluded.body.data.centres.some((c) => c.name === 'District Filter Shelter'),
    'both filters must apply, so a zone that does not cover the centre excludes it'
  );

  // The zone that does cover it, with the same district, still finds it.
  const zoneA = zones.find((z) => z.code === 'ZONE-A');
  const included = await request(
    createClient(),
    'GET',
    `/api/public/centres?zoneId=${zoneA.id}&districtId=${geography.district.id}`
  );
  assert.ok(
    included.body.data.centres.some((c) => c.name === 'District Filter Shelter'),
    'the covering zone plus the correct district must still match'
  );
});

test('current coordinates rank centres by straight-line distance without exposing secrets', async () => {
  const near = await request(evacuation, 'POST', '/api/centres', {
    wardId: geography.wards[0].id,
    name: 'Near GPS Shelter',
    locationDescription: 'Close to the test position',
    latitude: 27.7173,
    longitude: 85.3241,
    maximumCapacity: 100,
    facilities: []
  });
  const far = await request(evacuation, 'POST', '/api/centres', {
    wardId: geography.wards[0].id,
    name: 'Far GPS Shelter',
    locationDescription: 'Farther from the test position',
    latitude: 27.8,
    longitude: 85.4,
    maximumCapacity: 100,
    facilities: []
  });
  assert.equal(near.status, 201);
  assert.equal(far.status, 201);

  const result = await request(
    createClient(),
    'GET',
    '/api/public/centres?latitude=27.7172&longitude=85.3240'
  );
  assert.equal(result.status, 200);

  const nearIndex = result.body.data.centres.findIndex((centre) => centre.name === 'Near GPS Shelter');
  const farIndex = result.body.data.centres.findIndex((centre) => centre.name === 'Far GPS Shelter');
  assert.ok(nearIndex >= 0 && farIndex >= 0);
  assert.ok(nearIndex < farIndex, 'the nearer open centre must be ranked first');
  assert.ok(result.body.data.centres[nearIndex].distanceKm < result.body.data.centres[farIndex].distanceKm);
  assert.equal(typeof result.body.data.centres[nearIndex].latitude, 'number');
  assert.ok(!JSON.stringify(result.body).includes('AWS_ACCESS_KEY_ID'));
});

test('centre proximity requires a valid latitude and longitude pair', async () => {
  for (const query of [
    'latitude=27.7',
    'latitude=91&longitude=85',
    'latitude=27&longitude=181',
    'latitude=hello&longitude=85'
  ]) {
    const result = await request(createClient(), 'GET', `/api/public/centres?${query}`);
    assert.equal(result.status, 400, `expected invalid coordinates for ${query}`);
    assert.equal(result.body.error.code, 'INVALID_COORDINATES');
  }
});
