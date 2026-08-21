const weatherService = require('../services/weather.service');

/**
 * River and rainfall context for a coordinate.
 *
 * Always responds 200. An unavailable upstream is a normal, expected state
 * rather than a request failure, so the client renders the rest of the screen
 * and simply omits the panel.
 */
async function getConditions(request, response) {
  const { latitude, longitude } = request.conditionsQuery;
  const conditions = await weatherService.getConditions(latitude, longitude);

  response.status(200).json({
    success: true,
    data: { conditions },
    message: conditions.available
      ? 'Conditions retrieved successfully'
      : 'Conditions are not available'
  });
}

module.exports = { getConditions };
