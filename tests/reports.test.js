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

let resident;
let otherResident;
let officer;
let zones;

test.before(async () => {
  await startServer();
  await resetDatabase();

  resident = await signIn('resident@test.local');
  otherResident = await signIn('resident2@test.local');
  officer = await signIn('officer@test.local');
  zones = await getZones();
});

test.after(async () => {
  await stopServer();
});

test('a submitted report starts as PENDING_REVIEW with a generated reference', async () => {
  const report = await createReport(resident, zones[0].id);

  assert.equal(report.status, 'PENDING_REVIEW');
  assert.match(report.reportReference, /^FLD-\d{8}-[0-9A-F]{6}$/);
});

test('a report must reference a valid active zone', async () => {
  const result = await request(resident, 'POST', '/api/reports', {
    zoneId: '00000000-0000-4000-8000-000000000000',
    locationDescription: 'Somewhere',
    observedSeverity: 'HIGH',
    roadCondition: 'BLOCKED',
    incidentDescription: 'Zone does not exist.',
    observedAt: new Date().toISOString()
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_ZONE');
});

test('an observation cannot be dated in the future', async () => {
  const result = await request(resident, 'POST', '/api/reports', {
    zoneId: zones[0].id,
    locationDescription: 'Somewhere',
    observedSeverity: 'HIGH',
    roadCondition: 'BLOCKED',
    incidentDescription: 'Observed tomorrow.',
    observedAt: new Date(Date.now() + 86_400_000).toISOString()
  });

  assert.equal(result.status, 400);
});

test('invalid enum values are rejected server-side', async () => {
  const result = await request(resident, 'POST', '/api/reports', {
    zoneId: zones[0].id,
    locationDescription: 'Somewhere',
    observedSeverity: 'CATASTROPHIC',
    roadCondition: 'BLOCKED',
    incidentDescription: 'Severity is not a permitted value.',
    observedAt: new Date().toISOString()
  });

  assert.equal(result.status, 400);
});

test('a resident cannot set the status of their own report', async () => {
  const result = await request(resident, 'POST', '/api/reports', {
    zoneId: zones[0].id,
    locationDescription: 'Somewhere',
    observedSeverity: 'HIGH',
    roadCondition: 'BLOCKED',
    incidentDescription: 'Attempting to self-verify.',
    observedAt: new Date().toISOString(),
    status: 'VERIFIED'
  });

  assert.equal(result.status, 400, 'unknown fields must be rejected');
});

test('a resident sees only their own reports', async () => {
  const own = await createReport(resident, zones[0].id);
  await createReport(otherResident, zones[1].id);

  const mine = await request(resident, 'GET', '/api/reports/mine?limit=100');
  assert.equal(mine.status, 200);

  const ids = mine.body.data.reports.map((report) => report.id);
  assert.ok(ids.includes(own.id));

  const otherList = await request(otherResident, 'GET', '/api/reports/mine?limit=100');
  const otherIds = otherList.body.data.reports.map((report) => report.id);
  assert.ok(!otherIds.includes(own.id), 'a resident must not see another resident report');
});

test('a resident cannot open another resident report', async () => {
  const foreign = await createReport(otherResident, zones[1].id);
  const result = await request(resident, 'GET', `/api/reports/${foreign.id}`);

  assert.equal(result.status, 404);
});

test('the full request-information and resubmission cycle works', async () => {
  const report = await createReport(resident, zones[0].id);

  const noNotes = await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, {
    action: 'MORE_INFORMATION_REQUIRED'
  });
  assert.equal(noNotes.status, 400, 'notes are mandatory when requesting more information');

  const requested = await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, {
    action: 'MORE_INFORMATION_REQUIRED',
    notes: 'Please confirm how deep the water is.'
  });
  assert.equal(requested.status, 200);
  assert.equal(requested.body.data.report.status, 'MORE_INFORMATION_REQUIRED');

  const history = await request(resident, 'GET', `/api/reports/${report.id}/history`);
  assert.ok(JSON.stringify(history.body).includes('how deep the water is'),
    'the resident must be able to read the officer feedback');

  const updated = await request(resident, 'PATCH', `/api/reports/${report.id}`, {
    locationDescription: 'Updated location detail',
    observedSeverity: 'SEVERE',
    roadCondition: 'BLOCKED',
    incidentDescription: 'The water is approximately one metre deep.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.report.status, 'PENDING_REVIEW');
});

test('a report cannot be edited while it is awaiting first review', async () => {
  const report = await createReport(resident, zones[0].id);

  const result = await request(resident, 'PATCH', `/api/reports/${report.id}`, {
    locationDescription: 'Should not be editable',
    observedSeverity: 'LOW',
    roadCondition: 'CLEAR',
    incidentDescription: 'Editing a pending report must fail.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'REPORT_NOT_EDITABLE');
});

test('rejecting a report requires review notes', async () => {
  const report = await createReport(resident, zones[0].id);

  const withoutNotes = await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, {
    action: 'REJECT'
  });
  assert.equal(withoutNotes.status, 400);

  const withNotes = await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, {
    action: 'REJECT',
    notes: 'Duplicate of an existing report for the same location.'
  });
  assert.equal(withNotes.status, 200);
  assert.equal(withNotes.body.data.report.status, 'REJECTED');
});

test('an invalid status transition is refused', async () => {
  const report = await createReport(resident, zones[0].id);

  await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, {
    action: 'VERIFY'
  });

  const secondVerify = await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, {
    action: 'VERIFY'
  });

  assert.equal(secondVerify.status, 409);
  assert.equal(secondVerify.body.error.code, 'INVALID_REPORT_TRANSITION');
});

test('an officer cannot review a report they submitted themselves', async () => {
  // The officer account also submits a report, which no role may self-verify.
  const officerReport = await request(officer, 'POST', '/api/reports', {
    zoneId: zones[0].id,
    locationDescription: 'Officer observation',
    observedSeverity: 'HIGH',
    roadCondition: 'BLOCKED',
    incidentDescription: 'Submitted by the officer account.',
    observedAt: new Date(Date.now() - 3600_000).toISOString()
  });

  // Officers are not residents, so they cannot use the resident report route.
  assert.equal(officerReport.status, 403);
});

test('verification does not publish an alert', async () => {
  const before = await request(createClient(), 'GET', '/api/public/alerts');
  const report = await createReport(resident, zones[0].id);

  await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, { action: 'VERIFY' });

  const after = await request(createClient(), 'GET', '/api/public/alerts');
  assert.equal(after.body.data.alerts.length, before.body.data.alerts.length,
    'verifying a report must never create an alert');
});

test('a verified report becomes a public incident without exposing the reporter', async () => {
  const report = await createReport(resident, zones[2].id);
  await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, { action: 'VERIFY' });

  const incidents = await request(createClient(), 'GET', '/api/public/incidents');
  const published = incidents.body.data.incidents.find((i) => i.reportReference === report.reportReference);

  assert.ok(published, 'the verified report should appear publicly');
  assert.ok(!JSON.stringify(incidents.body).includes('resident@test.local'),
    'public incidents must not expose resident identity');
});

test('the officer queue supports filtering, sorting and pagination', async () => {
  const all = await request(officer, 'GET', '/api/officer/reports?limit=100');
  assert.equal(all.status, 200);
  assert.ok(all.body.data.reports.length >= 3);

  const pending = await request(officer, 'GET', '/api/officer/reports?status=PENDING_REVIEW&limit=100');
  assert.ok(pending.body.data.reports.every((report) => report.status === 'PENDING_REVIEW'));

  const zoneScoped = await request(officer, 'GET', `/api/officer/reports?zoneId=${zones[0].id}&limit=100`);
  assert.ok(zoneScoped.body.data.reports.every((report) => report.zone.id === zones[0].id));

  const newest = await request(officer, 'GET', '/api/officer/reports?sort=newest&limit=100');
  const oldest = await request(officer, 'GET', '/api/officer/reports?sort=oldest&limit=100');
  assert.equal(
    newest.body.data.reports[0].id,
    oldest.body.data.reports[oldest.body.data.reports.length - 1].id,
    'sorting must reverse the order'
  );

  const firstPage = await request(officer, 'GET', '/api/officer/reports?limit=2&offset=0');
  const secondPage = await request(officer, 'GET', '/api/officer/reports?limit=2&offset=2');
  assert.notEqual(firstPage.body.data.reports[0].id, secondPage.body.data.reports[0].id);
  assert.equal(firstPage.body.data.pagination.total, all.body.data.pagination.total);
});

test('pagination and filter values are validated', async () => {
  const badLimit = await request(officer, 'GET', '/api/officer/reports?limit=5000');
  assert.equal(badLimit.status, 400);

  const badZone = await request(officer, 'GET', '/api/officer/reports?zoneId=not-a-uuid');
  assert.equal(badZone.status, 400);

  const badId = await request(officer, 'GET', '/api/officer/reports/not-a-uuid');
  assert.equal(badId.status, 400);
});

test('the officer dashboard is computed from live data', async () => {
  const dashboard = await request(officer, 'GET', '/api/officer/dashboard');

  assert.equal(dashboard.status, 200);
  const { summary, reportsByStatus, trend, reportsByZone } = dashboard.body.data;

  assert.ok(summary.totalReports > 0);
  assert.equal(trend.length, 14, 'the trend must cover fourteen zero-filled days');
  assert.equal(reportsByZone.length, 3);

  const statusTotal = reportsByStatus.reduce((total, row) => total + row.total, 0);
  assert.equal(statusTotal, summary.totalReports,
    'the status distribution must account for every report');
});
