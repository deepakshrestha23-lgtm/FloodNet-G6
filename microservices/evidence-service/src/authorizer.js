const jwt = require('jsonwebtoken');

function getToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function handler(event) {
  const token = getToken(event);

  if (!token || !process.env.EVIDENCE_UPLOAD_JWT_SECRET) {
    return { isAuthorized: false };
  }

  try {
    const payload = jwt.verify(token, process.env.EVIDENCE_UPLOAD_JWT_SECRET);
    const valid = payload.type === 'evidence-upload'
      && payload.scope === 'evidence:upload'
      && payload.sub
      && payload.rid;

    if (!valid) return { isAuthorized: false };

    return {
      isAuthorized: true,
      context: {
        userId: payload.sub,
        reportId: payload.rid,
        scope: payload.scope
      }
    };
  } catch (_error) {
    return { isAuthorized: false };
  }
}

module.exports = { handler };
