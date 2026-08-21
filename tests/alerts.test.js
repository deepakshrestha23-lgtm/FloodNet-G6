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

let officer;
let zones;

function alertPayload(overrides = {}) {
  return {
    title: 'Rising water in the northern riverbank area',
    severity: 'WARNING',
    warningDescription: 'Water levels are rising and the riverbank road is affected.',
    recommendedActions: 'Avoid the riverbank road and prepare to move to higher ground.',
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
    zoneIds: [zones[0].id],
    ...overrides
  };
}

async function createDraft(overrides) {
  const result = await request(officer, 'POST', '/api/officer/alerts', alertPayload(overrides));
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.data.alert;
}

test.before(async () => {
  await startServer();
  await resetDatabase();

  officer = await signIn('officer@test.local');
  zones = await getZones();
});

test.after(async () => {
  await stopServer();
});

test('a new alert is created as a draft and is not public', async () => {
  const alert = await createDraft();

  assert.equal(alert.status, 'DRAFT');
  assert.equal(alert.isActive, false);
  assert.match(alert.alertReference, /^ALT-\d{8}-[0-9A-F]{6}$/);

  const publicAlerts = await request(createClient(), 'GET', '/api/public/alerts');
  assert.ok(!publicAlerts.body.data.alerts.some((a) => a.id === alert.id),
    'a draft must never be publicly visible');
});

test('an alert must target at least one zone', async () => {
  const result = await request(officer, 'POST', '/api/officer/alerts', alertPayload({ zoneIds: [] }));
  assert.equal(result.status, 400);
});

test('an alert cannot target an unknown zone', async () => {
  const result = await request(officer, 'POST', '/api/officer/alerts', alertPayload({
    zoneIds: ['00000000-0000-4000-8000-000000000000']
  }));

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_ZONE');
});

test('the expiry time must be later than the start time', async () => {
  const result = await request(officer, 'POST', '/api/officer/alerts', alertPayload({
    validFrom: new Date(Date.now() + 3600_000).toISOString(),
    expiresAt: new Date().toISOString()
  }));

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_ALERT_WINDOW');
});

test('an invalid severity is rejected', async () => {
  const result = await request(officer, 'POST', '/api/officer/alerts', alertPayload({ severity: 'CATASTROPHIC' }));
  assert.equal(result.status, 400);
});

test('publishing makes an alert publicly visible and active', async () => {
  const alert = await createDraft();

  const published = await request(officer, 'POST', `/api/officer/alerts/${alert.id}/publish`);
  assert.equal(published.status, 200);
  assert.equal(published.body.data.alert.status, 'PUBLISHED');
  assert.equal(published.body.data.alert.isActive, true);

  const publicAlerts = await request(createClient(), 'GET', '/api/public/alerts');
  assert.ok(publicAlerts.body.data.alerts.some((a) => a.id === alert.id));

  const zoneScoped = await request(createClient(), 'GET', `/api/public/alerts?zoneId=${zones[0].id}`);
  assert.ok(zoneScoped.body.data.alerts.some((a) => a.id === alert.id));

  const otherZone = await request(createClient(), 'GET', `/api/public/alerts?zoneId=${zones[1].id}`);
  assert.ok(!otherZone.body.data.alerts.some((a) => a.id === alert.id),
    'the alert must not appear for a zone it does not target');
});

test('an alert cannot be published twice', async () => {
  const alert = await createDraft();

  await request(officer, 'POST', `/api/officer/alerts/${alert.id}/publish`);
  const second = await request(officer, 'POST', `/api/officer/alerts/${alert.id}/publish`);

  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'INVALID_ALERT_TRANSITION');
});

test('a draft cannot be expired before it is published', async () => {
  const alert = await createDraft();
  const result = await request(officer, 'POST', `/api/officer/alerts/${alert.id}/expire`);

  assert.equal(result.status, 409);
});

test('an expired alert disappears from the active public list', async () => {
  const alert = await createDraft();
  await request(officer, 'POST', `/api/officer/alerts/${alert.id}/publish`);

  const expired = await request(officer, 'POST', `/api/officer/alerts/${alert.id}/expire`);
  assert.equal(expired.status, 200);

  const publicAlerts = await request(createClient(), 'GET', '/api/public/alerts');
  assert.ok(!publicAlerts.body.data.alerts.some((a) => a.id === alert.id));
});

/**
 * Active status is derived from the validity window on every read, so an alert
 * whose window has already closed must never be reported as active even though
 * its stored status is still PUBLISHED.
 */
test('a published alert outside its validity window is not active', async () => {
  const alert = await createDraft({
    validFrom: new Date(Date.now() - 7200_000).toISOString(),
    expiresAt: new Date(Date.now() - 3600_000).toISOString()
  });

  await request(officer, 'POST', `/api/officer/alerts/${alert.id}/publish`);

  const detail = await request(officer, 'GET', `/api/officer/alerts/${alert.id}`);
  assert.equal(detail.body.data.alert.status, 'PUBLISHED');
  assert.equal(detail.body.data.alert.isActive, false);

  const publicAlerts = await request(createClient(), 'GET', '/api/public/alerts');
  assert.ok(!publicAlerts.body.data.alerts.some((a) => a.id === alert.id),
    'an out-of-window alert must not be shown as active');
});

test('a cancelled alert is withdrawn and becomes immutable', async () => {
  const alert = await createDraft();
  await request(officer, 'POST', `/api/officer/alerts/${alert.id}/publish`);

  const cancelled = await request(officer, 'POST', `/api/officer/alerts/${alert.id}/cancel`);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.alert.status, 'CANCELLED');

  const publicAlerts = await request(createClient(), 'GET', '/api/public/alerts');
  assert.ok(!publicAlerts.body.data.alerts.some((a) => a.id === alert.id));

  const edit = await request(officer, 'PATCH', `/api/officer/alerts/${alert.id}`, alertPayload());
  assert.equal(edit.status, 409);
  assert.equal(edit.body.error.code, 'ALERT_NOT_EDITABLE');
});

test('a draft and a published alert can both be edited', async () => {
  const draft = await createDraft();

  const editDraft = await request(officer, 'PATCH', `/api/officer/alerts/${draft.id}`,
    alertPayload({ title: 'Revised draft title for the riverbank warning' }));
  assert.equal(editDraft.status, 200);
  assert.equal(editDraft.body.data.alert.title, 'Revised draft title for the riverbank warning');

  await request(officer, 'POST', `/api/officer/alerts/${draft.id}/publish`);

  const editPublished = await request(officer, 'PATCH', `/api/officer/alerts/${draft.id}`,
    alertPayload({ title: 'Corrected wording while the alert is live' }));
  assert.equal(editPublished.status, 200, 'wording must be correctable during an incident');
});

test('alerts can be filtered by status and by zone', async () => {
  const byStatus = await request(officer, 'GET', '/api/officer/alerts?status=DRAFT&limit=100');
  assert.equal(byStatus.status, 200);
  assert.ok(byStatus.body.data.alerts.every((a) => a.status === 'DRAFT'));

  const byZone = await request(officer, 'GET', `/api/officer/alerts?zoneId=${zones[0].id}&limit=100`);
  assert.equal(byZone.status, 200);
  assert.ok(byZone.body.data.alerts.every((a) => a.zones.some((z) => z.id === zones[0].id)));
});

test('an unknown alert id returns 404', async () => {
  const result = await request(officer, 'GET', '/api/officer/alerts/00000000-0000-4000-8000-000000000000');
  assert.equal(result.status, 404);
});

/**
 * The delivery path a resident actually depends on: an officer targets a ward,
 * and the resident whose home ward that is sees the alert. This is the reason
 * user_profiles.home_ward_id exists, so it is covered end to end.
 */
test('a ward-targeted alert reaches the ward it names and not another ward', async () => {
  const provinces = await request(createClient(), 'GET', '/api/geography/provinces');
  const districts = await request(createClient(), 'GET', `/api/geography/districts?provinceId=${provinces.body.data.provinces[0].id}`);
  const localLevels = await request(createClient(), 'GET', `/api/geography/local-levels?districtId=${districts.body.data.districts[0].id}`);
  const wards = await request(createClient(), 'GET', `/api/geography/wards?localLevelId=${localLevels.body.data.localLevels[0].id}`);

  const targetWard = wards.body.data.wards[0];
  const otherWard = wards.body.data.wards[1];
  assert.ok(otherWard, 'the harness must seed more than one ward');

  const alert = await createDraft({ zoneIds: [], wardIds: [targetWard.id] });
  const published = await request(officer, 'POST', `/api/officer/alerts/${alert.id}/publish`);
  assert.equal(published.status, 200, JSON.stringify(published.body));

  const forTargetWard = await request(createClient(), 'GET', `/api/public/alerts?wardId=${targetWard.id}`);
  assert.equal(forTargetWard.status, 200);
  assert.ok(
    forTargetWard.body.data.alerts.some((a) => a.id === alert.id),
    'a resident whose home ward is targeted must see the alert'
  );

  const forOtherWard = await request(createClient(), 'GET', `/api/public/alerts?wardId=${otherWard.id}`);
  assert.ok(
    !forOtherWard.body.data.alerts.some((a) => a.id === alert.id),
    'a resident in an untargeted ward must not see it'
  );

  const unfiltered = await request(createClient(), 'GET', '/api/public/alerts');
  assert.ok(
    unfiltered.body.data.alerts.some((a) => a.id === alert.id),
    'an unfiltered reader still sees every published alert'
  );
});
