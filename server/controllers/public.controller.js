const publicService = require('../services/public.service');

async function zones(_request, response) {
  response.status(200).json({
    success: true,
    data: { zones: await publicService.getZones() },
    message: 'Operational risk areas retrieved successfully'
  });
}

async function alerts(request, response) {
  // totalActive counts every live alert regardless of area, so the client can
  // distinguish "nothing here" from "nothing anywhere".
  const { alerts: activeAlerts, totalActive } = await publicService.getAlerts(
    request.query.zoneId,
    request.query.wardId,
    request.query
  );

  response.status(200).json({
    success: true,
    data: { alerts: activeAlerts, totalActive },
    message: 'Active alerts retrieved successfully'
  });
}

async function incidents(request, response) {
  response.status(200).json({
    success: true,
    data: {
      incidents: await publicService.getIncidents(
        request.query.zoneId,
        request.query.wardId,
        Number(request.query.limit || 50),
        request.query
      )
    },
    message: 'Verified incidents retrieved successfully'
  });
}

async function centres(request, response) {
  const { centres: activeCentres, totalActive } = await publicService.getCentres(
    request.query.zoneId,
    request.query.wardId,
    request.query
  );

  response.status(200).json({
    success: true,
    data: { centres: activeCentres, totalActive },
    message: 'Evacuation centres retrieved successfully'
  });
}

module.exports = { zones, alerts, incidents, centres };
