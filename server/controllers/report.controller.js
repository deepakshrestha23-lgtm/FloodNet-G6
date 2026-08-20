const reportService = require('../services/report.service');

async function create(request, response) {
  const report = await reportService.submitReport(request.user.id, {
    ...request.body,
    observedAt: new Date(request.body.observedAt)
  });

  response.status(201).json({
    success: true,
    data: { report },
    message: 'Flood report submitted successfully'
  });
}

async function listMine(request, response) {
  const result = await reportService.listMine(request.user.id, request.reportQuery);

  response.status(200).json({
    success: true,
    data: {
      reports: result.reports,
      pagination: {
        total: result.total,
        limit: request.reportQuery.limit,
        offset: request.reportQuery.offset
      }
    },
    message: 'Reports retrieved successfully'
  });
}

async function getMine(request, response) {
  const report = await reportService.getMine(request.user.id, request.params.id);

  response.status(200).json({
    success: true,
    data: { report },
    message: 'Report retrieved successfully'
  });
}

async function getHistory(request, response) {
  const history = await reportService.getHistory(request.user.id, request.params.id);

  response.status(200).json({
    success: true,
    data: history,
    message: 'Report history retrieved successfully'
  });
}

async function update(request, response) {
  const report = await reportService.updateMoreInformation(request.user.id, request.params.id, {
    ...request.body,
    observedAt: new Date(request.body.observedAt)
  });

  response.status(200).json({
    success: true,
    data: { report },
    message: 'Additional report information submitted successfully'
  });
}

module.exports = { create, listMine, getMine, getHistory, update };
