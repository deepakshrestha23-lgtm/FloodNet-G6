const { checkDatabase } = require('../db/pool');

function getHealth(_request, response) {
  response.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'floodnet-api',
      timestamp: new Date().toISOString()
    },
    message: 'Application running'
  });
}

async function getDatabaseHealth(_request, response, next) {
  try {
    const database = await checkDatabase();
    const statusCode = database.connected ? 200 : 503;

    response.status(statusCode).json({
      success: database.connected,
      data: { database },
      message: database.connected
        ? 'Database connection healthy'
        : 'Database is not configured or unavailable'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getHealth, getDatabaseHealth };
