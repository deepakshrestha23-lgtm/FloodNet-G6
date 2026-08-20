const { AppError } = require('../utils/http-error');
const { verifyAccessToken } = require('../utils/jwt');
const { findUserById } = require('../repositories/user.repository');

async function authenticate(request, _response, next) {
  const authorization = request.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'A valid access token is required'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);

    if (payload.type !== 'access' || !payload.sub) {
      throw new Error('Invalid access token claims');
    }
  } catch (_error) {
    return next(new AppError(401, 'INVALID_ACCESS_TOKEN', 'The access token is invalid or expired'));
  }

  const user = await findUserById(payload.sub);

  if (!user || user.status !== 'ACTIVE') {
    return next(new AppError(401, 'ACCOUNT_INACTIVE', 'This account is inactive or unavailable'));
  }

  request.user = user;
  return next();
}

function requireRoles(...allowedRoles) {
  return (request, _response, next) => {
    if (!request.user) {
      return next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
    }

    if (!allowedRoles.includes(request.user.roleCode)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }

    return next();
  };
}

module.exports = { authenticate, requireRoles };
