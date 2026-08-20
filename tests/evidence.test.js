const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer,
  stopServer,
  resetDatabase,
  request,
  signIn,
  getZones,
  createReport,
  pngBuffer
} = require('./helpers/harness');

let resident;
let otherResident;
let officer;
let evacuation;
let zones;

function evidenceForm(files) {
  const data = new FormData();

  for (const file of files) {
    data.append('evidence', new Blob([file.buffer], { type: file.type }), file.name);
  }

  return data;
}

async function upload(client, reportId, files) {
  return request(client, 'POST', `/api/reports/${reportId}/evidence`, evidenceForm(files), { form: true });
}

test.before(async () => {
  await startServer();
  await resetDatabase();

  resident = await signIn('resident@test.local');
  otherResident = await signIn('resident2@test.local');
  officer = await signIn('officer@test.local');
  evacuation = await signIn('evacuation@test.local');
  zones = await getZones();
});

test.after(async () => {
  await stopServer();
});

test('a resident can attach images and only metadata is returned', async () => {
  const report = await createReport(resident, zones[0].id);

  const result = await upload(resident, report.id, [
    { buffer: pngBuffer(4096), type: 'image/png', name: 'flooded-road.png' }
  ]);

  assert.equal(result.status, 201);

  const evidence = result.body.data.evidence[0];
  assert.equal(evidence.uploadStatus, 'UPLOADED');
  assert.equal(evidence.contentType, 'image/png');
  assert.equal(typeof evidence.sizeBytes, 'number');
  assert.equal(evidence.checksum.length, 64);

  // The API must never hand back image bytes.
  assert.ok(!JSON.stringify(result.body).includes('data:image'));
  assert.equal(evidence.body, undefined);
});

/**
 * The stored object key must not be guessable from the original filename, so a
 * resident cannot infer or address another resident's uploads.
 */
test('the storage key is namespaced and randomised', async () => {
  const report = await createReport(resident, zones[0].id);

  const result = await upload(resident, report.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'my-holiday-photo.png' }
  ]);

  const { objectKey } = result.body.data.evidence[0];

  assert.ok(objectKey.startsWith(`reports/${resident.user.id}/${report.id}/`));
  assert.ok(!objectKey.includes('my-holiday-photo'));
  assert.ok(objectKey.endsWith('.png'));
});

test('a non-image file is rejected', async () => {
  const report = await createReport(resident, zones[0].id);

  const result = await upload(resident, report.id, [
    { buffer: Buffer.from('%PDF-1.4 not an image'), type: 'application/pdf', name: 'document.pdf' }
  ]);

  assert.equal(result.status, 400);
});

/**
 * A declared content type is attacker-controlled, so the file signature is
 * checked as well.
 */
test('a file that only claims to be an image is rejected', async () => {
  const report = await createReport(resident, zones[0].id);

  const result = await upload(resident, report.id, [
    { buffer: Buffer.from('this text is not a png at all'), type: 'image/png', name: 'spoofed.png' }
  ]);

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_EVIDENCE_CONTENT');
});

test('an oversized image is rejected', async () => {
  const report = await createReport(resident, zones[0].id);

  const result = await upload(resident, report.id, [
    { buffer: pngBuffer(6 * 1024 * 1024), type: 'image/png', name: 'huge.png' }
  ]);

  assert.equal(result.status, 400);
});

test('an upload with no files is rejected', async () => {
  const report = await createReport(resident, zones[0].id);
  const result = await request(resident, 'POST', `/api/reports/${report.id}/evidence`, new FormData(), { form: true });

  assert.equal(result.status, 400);
});

test('a report cannot hold more than five evidence files', async () => {
  const report = await createReport(resident, zones[0].id);

  const first = await upload(resident, report.id, Array.from({ length: 5 }, (_, index) => ({
    buffer: pngBuffer(1024),
    type: 'image/png',
    name: `image-${index}.png`
  })));
  assert.equal(first.status, 201);

  const extra = await upload(resident, report.id, [
    { buffer: pngBuffer(1024), type: 'image/png', name: 'one-too-many.png' }
  ]);
  assert.equal(extra.status, 409);
  assert.equal(extra.body.error.code, 'EVIDENCE_LIMIT_REACHED');
});

test('a resident cannot attach evidence to another resident report', async () => {
  const foreign = await createReport(otherResident, zones[0].id);

  const result = await upload(resident, foreign.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'not-mine.png' }
  ]);

  assert.equal(result.status, 404);
});

test('a resident cannot list evidence on another resident report', async () => {
  const foreign = await createReport(otherResident, zones[0].id);
  await upload(otherResident, foreign.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'theirs.png' }
  ]);

  const result = await request(resident, 'GET', `/api/reports/${foreign.id}/evidence`);
  assert.equal(result.status, 404);
});

test('evidence cannot be added once a report has been verified', async () => {
  const report = await createReport(resident, zones[0].id);
  await request(officer, 'POST', `/api/officer/reports/${report.id}/review`, { action: 'VERIFY' });

  const result = await upload(resident, report.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'too-late.png' }
  ]);

  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'REPORT_EVIDENCE_LOCKED');
});

test('a reviewing officer can see the evidence attached to any report', async () => {
  const report = await createReport(resident, zones[0].id);
  await upload(resident, report.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'evidence.png' }
  ]);

  const dossier = await request(officer, 'GET', `/api/officer/reports/${report.id}`);

  assert.equal(dossier.status, 200);
  assert.equal(dossier.body.data.evidence.length, 1);
  assert.equal(dossier.body.data.evidence[0].originalFilename, 'evidence.png');

  // The dossier lists metadata only; the object key is not exposed to the client.
  assert.ok(!JSON.stringify(dossier.body.data.evidence).includes('reports/'));
});

test('evidence access is refused to roles outside the review workflow', async () => {
  const report = await createReport(resident, zones[0].id);
  const uploaded = await upload(resident, report.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'evidence.png' }
  ]);
  const evidenceId = uploaded.body.data.evidence[0].id;

  const evacuationAttempt = await request(evacuation, 'GET', `/api/reports/${report.id}/evidence`);
  assert.equal(evacuationAttempt.status, 403);

  const evacuationOfficerRoute = await request(
    evacuation,
    'GET',
    `/api/officer/reports/${report.id}/evidence/${evidenceId}/url`
  );
  assert.equal(evacuationOfficerRoute.status, 403);

  const anonymous = await request({ cookies: new Map(), accessToken: null }, 'GET',
    `/api/reports/${report.id}/evidence`);
  assert.equal(anonymous.status, 401);
});

test('an officer receives a time-limited access link, not the image itself', async () => {
  const report = await createReport(resident, zones[0].id);
  const uploaded = await upload(resident, report.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'evidence.png' }
  ]);
  const evidenceId = uploaded.body.data.evidence[0].id;

  const access = await request(officer, 'GET', `/api/officer/reports/${report.id}/evidence/${evidenceId}/url`);

  assert.equal(access.status, 200);
  assert.ok(access.body.data.downloadUrl.startsWith('https://'));
  assert.ok(access.body.data.expiresIn > 0, 'the link must expire');
  assert.ok(access.body.data.expiresIn <= 900, 'the link must be short lived');
});

test('the owning resident can obtain an access link for their own evidence', async () => {
  const report = await createReport(resident, zones[0].id);
  const uploaded = await upload(resident, report.id, [
    { buffer: pngBuffer(2048), type: 'image/png', name: 'mine.png' }
  ]);
  const evidenceId = uploaded.body.data.evidence[0].id;

  const own = await request(resident, 'GET', `/api/reports/${report.id}/evidence/${evidenceId}/url`);
  assert.equal(own.status, 200);
  assert.ok(own.body.data.downloadUrl.startsWith('https://'));

  const foreign = await request(otherResident, 'GET', `/api/reports/${report.id}/evidence/${evidenceId}/url`);
  assert.equal(foreign.status, 404, 'another resident must not obtain an access link');
});

test('an unknown evidence id is not found for the reviewing officer', async () => {
  const report = await createReport(resident, zones[0].id);

  const result = await request(
    officer,
    'GET',
    `/api/officer/reports/${report.id}/evidence/00000000-0000-4000-8000-000000000000/url`
  );

  assert.equal(result.status, 404);
});

test('public endpoints never expose evidence', async () => {
  const incidents = await request({ cookies: new Map(), accessToken: null }, 'GET', '/api/public/incidents');

  assert.equal(incidents.status, 200);
  assert.ok(!JSON.stringify(incidents.body).includes('objectKey'));
  assert.ok(!JSON.stringify(incidents.body).includes('evidence'));
});
