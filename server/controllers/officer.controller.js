const officerService = require('../services/officer.service');
const evidenceService = require('../services/evidence.service');

async function listReports(request, response) {
  const result = await officerService.listReports(request.user, request.queueQuery);

  response.status(200).json({
    success: true,
    data: {
      reports: result.reports,
      pagination: {
        total: result.total,
        limit: request.queueQuery.limit,
        offset: request.queueQuery.offset
      }
    },
    message: 'Review queue retrieved successfully'
  });
}

async function getReport(request, response) {
  const dossier = await officerService.getReport(request.user, request.params.id);

  response.status(200).json({
    success: true,
    data: dossier,
    message: 'Report retrieved successfully'
  });
}

async function evidenceUrl(request, response) {
  const result = await evidenceService.getDownloadUrlForOfficer(
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

async function reviewReport(request, response) {
  const dossier = await officerService.reviewReport(request.user, request.params.id, request.body);

  response.status(200).json({
    success: true,
    data: dossier,
    message: 'Review decision recorded successfully'
  });
}

async function listAlerts(request, response) {
  const result = await officerService.listAlerts(request.user, request.alertQuery);

  response.status(200).json({
    success: true,
    data: {
      alerts: result.alerts,
      pagination: {
        total: result.total,
        limit: request.alertQuery.limit,
        offset: request.alertQuery.offset
      }
    },
    message: 'Alerts retrieved successfully'
  });
}

async function getAlert(request, response) {
  const alert = await officerService.getAlert(request.user, request.params.id);

  response.status(200).json({
    success: true,
    data: { alert },
    message: 'Alert retrieved successfully'
  });
}

async function createAlert(request, response) {
  const alert = await officerService.createAlert(request.user, request.alertInput);

  response.status(201).json({
    success: true,
    data: { alert },
    message: 'Alert draft created successfully'
  });
}

async function updateAlert(request, response) {
  const alert = await officerService.updateAlert(request.user, request.params.id, request.alertInput);

  response.status(200).json({
    success: true,
    data: { alert },
    message: 'Alert updated successfully'
  });
}

function transitionHandler(transitionName, message) {
  return async (request, response) => {
    const alert = await officerService.transitionAlert(request.user, request.params.id, transitionName);

    response.status(200).json({
      success: true,
      data: { alert },
      message
    });
  };
}

async function dashboard(request, response) {
  const data = await officerService.getDashboard(request.user, request.geographyQuery);

  response.status(200).json({
    success: true,
    data,
    message: 'Situation dashboard retrieved successfully'
  });
}

module.exports = {
  listReports,
  getReport,
  evidenceUrl,
  reviewReport,
  listAlerts,
  getAlert,
  createAlert,
  updateAlert,
  publishAlert: transitionHandler('publish', 'Alert published successfully'),
  expireAlert: transitionHandler('expire', 'Alert expired successfully'),
  cancelAlert: transitionHandler('cancel', 'Alert cancelled successfully'),
  dashboard
};
