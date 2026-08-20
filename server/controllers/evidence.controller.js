const evidenceService = require('../services/evidence.service');

async function complete(request, response) {
  const evidence = await evidenceService.completeUpload(
    request.user.id,
    request.params.id,
    request.body
  );

  response.status(201).json({
    success: true,
    data: { evidence },
    message: 'Evidence metadata saved successfully'
  });
}

async function upload(request, response) {
  const evidence = await evidenceService.uploadMultipartFiles(
    request.user.id,
    request.params.id,
    request.files
  );

  response.status(201).json({
    success: true,
    data: { evidence },
    message: 'Evidence images uploaded successfully'
  });
}

async function session(request, response) {
  const session = await evidenceService.createUploadSession(request.user.id, request.params.id);

  response.status(200).json({
    success: true,
    data: session,
    message: 'Evidence upload session created'
  });
}

async function list(request, response) {
  const evidence = await evidenceService.listForResident(request.user.id, request.params.id);

  response.status(200).json({
    success: true,
    data: { evidence },
    message: 'Evidence metadata retrieved successfully'
  });
}

async function access(request, response) {
  const result = await evidenceService.getDownloadUrl(
    request.user.id,
    request.params.id,
    request.params.evidenceId
  );

  response.status(200).json({
    success: true,
    data: result,
    message: 'Evidence access URL generated'
  });
}

module.exports = { session, upload, complete, list, access };
