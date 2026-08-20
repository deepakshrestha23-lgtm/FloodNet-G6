const publicService = require('../services/public.service');

async function zones(_request, response) {
  response.status(200).json({
    success: true,
    data: { zones: await publicService.getZones() },
    message: 'Flood zones retrieved successfully'
  });
}

async function alerts(request, response) {
  response.status(200).json({
    success: true,
    data: { alerts: await publicService.getAlerts(request.query.zoneId) },
    message: 'Active alerts retrieved successfully'
  });
}

async function incidents(request, response) {
  response.status(200).json({
    success: true,
    data: { incidents: await publicService.getIncidents(request.query.zoneId, Number(request.query.limit || 50)) },
    message: 'Verified incidents retrieved successfully'
  });
}

async function centres(request, response) {
  response.status(200).json({
    success: true,
    data: { centres: await publicService.getCentres(request.query.zoneId) },
    message: 'Evacuation centres retrieved successfully'
  });
}

module.exports = { zones, alerts, incidents, centres };
