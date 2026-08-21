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
let facilityTypes;
let defaultWardId;

async function createCentre(overrides = {}) {
  const result = await request(evacuation, 'POST', '/api/centres', {
    zoneId: zones[0].id,
    wardId: defaultWardId,
    name: `Test Centre ${Math.random().toString(36).slice(2, 8)}`,
    locationDescription: 'Test centre location description',
    contactPhone: '+60123456700',
    maximumCapacity: 100,
    currentOccupancy: 0,
    facilities: [],
    ...overrides
  });

  return result;
}

test.before(async () => {
  await startServer();
  await resetDatabase();

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

  const types = await request(evacuation, 'GET', '/api/centres/facility-types');
  facilityTypes = types.body.data.facilityTypes;
});

test.after(async () => {
  await stopServer();
});

test('available space is calculated, never supplied by the client', async () => {
  const result = await createCentre({ maximumCapacity: 250, currentOccupancy: 40 });

  assert.equal(result.status, 201);
  assert.equal(result.body.data.centre.availableSpace, 210);
});

test('occupancy may not exceed capacity when a centre is created', async () => {
  const result = await createCentre({ maximumCapacity: 10, currentOccupancy: 50 });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'OCCUPANCY_EXCEEDS_CAPACITY');
});

test('a negative capacity is rejected', async () => {
  const result = await createCentre({ maximumCapacity: -5 });
  assert.equal(result.status, 400);
});

test('a new centre must use an official administrative ward', async () => {
  const result = await createCentre({ wardId: undefined });

  assert.equal(result.status, 400);
  assert.ok(result.body.error.details.includes('An administrative ward is required'));
});

test('a negative occupancy is rejected', async () => {
  const created = await createCentre({ maximumCapacity: 100 });
  const result = await request(evacuation, 'POST', `/api/centres/${created.body.data.centre.id}/occupancy`, {
    currentOccupancy: -1
  });

  assert.equal(result.status, 400);
});

test('occupancy above capacity is rejected on update', async () => {
  const created = await createCentre({ maximumCapacity: 100 });
  const result = await request(evacuation, 'POST', `/api/centres/${created.body.data.centre.id}/occupancy`, {
    currentOccupancy: 101
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'OCCUPANCY_EXCEEDS_CAPACITY');
});

test('operational status follows occupancy across its thresholds', async () => {
  const created = await createCentre({ maximumCapacity: 100, currentOccupancy: 0 });
  const centreId = created.body.data.centre.id;

  assert.equal(created.body.data.centre.operationalStatus, 'OPEN');

  const half = await request(evacuation, 'POST', `/api/centres/${centreId}/occupancy`, { currentOccupancy: 50 });
  assert.equal(half.body.data.centre.operationalStatus, 'OPEN');
  assert.equal(half.body.data.centre.availableSpace, 50);

  const near = await request(evacuation, 'POST', `/api/centres/${centreId}/occupancy`, { currentOccupancy: 85 });
  assert.equal(near.body.data.centre.operationalStatus, 'NEAR_CAPACITY');

  const full = await request(evacuation, 'POST', `/api/centres/${centreId}/occupancy`, { currentOccupancy: 100 });
  assert.equal(full.body.data.centre.operationalStatus, 'FULL');
  assert.equal(full.body.data.centre.availableSpace, 0);

  const backDown = await request(evacuation, 'POST', `/api/centres/${centreId}/occupancy`, { currentOccupancy: 10 });
  assert.equal(backDown.body.data.centre.operationalStatus, 'OPEN');
});

/**
 * Closure is an operational decision, not a capacity calculation, so a closed
 * centre must never be reopened automatically by an occupancy change.
 */
test('a closed centre stays closed when occupancy changes', async () => {
  const created = await createCentre({ maximumCapacity: 100, currentOccupancy: 10 });
  const centreId = created.body.data.centre.id;

  const closed = await request(evacuation, 'POST', `/api/centres/${centreId}/status`, {
    operationalStatus: 'CLOSED'
  });
  assert.equal(closed.body.data.centre.operationalStatus, 'CLOSED');

  const afterOccupancy = await request(evacuation, 'POST', `/api/centres/${centreId}/occupancy`, {
    currentOccupancy: 20
  });
  assert.equal(afterOccupancy.body.data.centre.operationalStatus, 'CLOSED');
  assert.equal(afterOccupancy.body.data.centre.currentOccupancy, 20);
});

test('capacity cannot be reduced below the recorded occupancy', async () => {
  const created = await createCentre({ maximumCapacity: 100, currentOccupancy: 80 });
  const centreId = created.body.data.centre.id;

  const shrink = await request(evacuation, 'PATCH', `/api/centres/${centreId}`, {
    zoneId: zones[0].id,
    wardId: defaultWardId,
    name: created.body.data.centre.name,
    locationDescription: 'Attempting to shrink below occupancy',
    maximumCapacity: 50,
    facilities: []
  });

  assert.equal(shrink.status, 409);
  assert.equal(shrink.body.error.code, 'CAPACITY_BELOW_OCCUPANCY');

  const allowed = await request(evacuation, 'PATCH', `/api/centres/${centreId}`, {
    zoneId: zones[0].id,
    wardId: defaultWardId,
    name: created.body.data.centre.name,
    locationDescription: 'Reducing capacity to exactly the occupancy is allowed',
    maximumCapacity: 80,
    facilities: []
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.centre.availableSpace, 0);
});

test('occupancy cannot be changed through the centre edit form', async () => {
  const created = await createCentre({ maximumCapacity: 100, currentOccupancy: 10 });

  const result = await request(evacuation, 'PATCH', `/api/centres/${created.body.data.centre.id}`, {
    zoneId: zones[0].id,
    wardId: defaultWardId,
    name: created.body.data.centre.name,
    locationDescription: 'Trying to change occupancy here',
    maximumCapacity: 100,
    currentOccupancy: 99,
    facilities: []
  });

  assert.equal(result.status, 400, 'occupancy belongs to its own audited endpoint');
});

test('facilities are stored and returned with the centre', async () => {
  const result = await createCentre({
    facilities: [
      { facilityTypeId: facilityTypes[0].id, notes: 'Bottled water available' },
      { facilityTypeId: facilityTypes[1].id }
    ]
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.data.centre.facilities.length, 2);

  const withNotes = result.body.data.centre.facilities.find((f) => f.notes);
  assert.equal(withNotes.notes, 'Bottled water available');
});

test('an unknown facility type is rejected', async () => {
  const result = await createCentre({
    facilities: [{ facilityTypeId: '00000000-0000-4000-8000-000000000000' }]
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_FACILITY_TYPE');
});

test('a centre must belong to a valid active zone', async () => {
  const result = await createCentre({ zoneId: '00000000-0000-4000-8000-000000000000' });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_ZONE');
});

test('an archived centre is hidden from the public and becomes read-only', async () => {
  const created = await createCentre({ maximumCapacity: 100 });
  const centreId = created.body.data.centre.id;

  const archived = await request(evacuation, 'POST', `/api/centres/${centreId}/archive`);
  assert.equal(archived.status, 200);

  const publicCentres = await request(createClient(), 'GET', '/api/public/centres');
  assert.ok(!publicCentres.body.data.centres.some((c) => c.id === centreId));

  const edit = await request(evacuation, 'PATCH', `/api/centres/${centreId}`, {
    zoneId: zones[0].id,
    wardId: defaultWardId,
    name: 'Archived edit attempt',
    locationDescription: 'Editing an archived centre must fail',
    maximumCapacity: 100,
    facilities: []
  });
  assert.equal(edit.status, 409);
});

test('the evacuation dashboard aggregates live capacity figures', async () => {
  const dashboard = await request(evacuation, 'GET', '/api/centres/dashboard');
  assert.equal(dashboard.status, 200);

  const { summary, byZone } = dashboard.body.data;

  assert.ok(summary.totalCapacity > 0);
  assert.equal(summary.totalAvailable, summary.totalCapacity - summary.totalOccupancy,
    'available spaces must equal capacity minus occupancy');
  assert.ok(summary.occupancyRate >= 0 && summary.occupancyRate <= 100);
  assert.equal(byZone.length, 3);
});

test('centres can be filtered by zone and by operational status', async () => {
  const byZone = await request(evacuation, 'GET', `/api/centres?zoneId=${zones[0].id}`);
  assert.equal(byZone.status, 200);
  assert.ok(byZone.body.data.centres.every((c) => c.zone.id === zones[0].id));

  const byStatus = await request(evacuation, 'GET', '/api/centres?status=OPEN');
  assert.ok(byStatus.body.data.centres.every((c) => c.operationalStatus === 'OPEN'));

  const invalid = await request(evacuation, 'GET', '/api/centres?status=NONSENSE');
  assert.equal(invalid.status, 400);
});
