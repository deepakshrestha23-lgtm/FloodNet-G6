const env = require('../config/env');
const authService = require('../services/auth.service');
const {
  REFRESH_TOKEN_MAX_AGE_MS,
  verifyRefreshToken
} = require('../utils/jwt');

const REFRESH_COOKIE_NAME = 'floodnet_refresh_token';
// The staging endpoint currently uses HTTP. A Secure cookie is ignored by
// browsers on HTTP, which would make every page refresh appear to log the user
// out. Once CLIENT_ORIGIN is changed to HTTPS, the cookie becomes Secure again.
const useSecureRefreshCookie = env.clientOrigin.startsWith('https://');
const refreshCookieOptions = {
  httpOnly: true,
  secure: useSecureRefreshCookie,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_MAX_AGE_MS
};

function setRefreshCookie(response, token) {
  response.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions);
}

function clearRefreshCookie(response) {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: useSecureRefreshCookie,
    sameSite: 'lax',
    path: '/api/auth'
  });
}

async function register(request, response) {
  const user = await authService.registerResident(request.body);

  response.status(201).json({
    success: true,
    data: { user },
    message: 'Resident account created successfully'
  });
}

async function login(request, response) {
  const result = await authService.login(request.body.email, request.body.password);
  setRefreshCookie(response, result.refreshToken);

  response.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user
    },
    message: 'Login successful'
  });
}

async function refresh(request, response) {
  const result = await authService.refresh(request.cookies[REFRESH_COOKIE_NAME]);
  if (result.refreshToken) {
    setRefreshCookie(response, result.refreshToken);
  }

  response.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user
    },
    message: 'Access token refreshed'
  });
}

async function logout(request, response) {
  await authService.logout(request.cookies[REFRESH_COOKIE_NAME]);
  clearRefreshCookie(response);

  response.status(200).json({
    success: true,
    data: null,
    message: 'Logout successful'
  });
}

function me(request, response) {
  response.status(200).json({
    success: true,
    data: { user: authService.toPublicUser(request.user) },
    message: 'Current user retrieved'
  });
}

async function updateMe(request, response) {
  const user = await authService.updateCurrentUser(request.user.id, request.body);

  response.status(200).json({
    success: true,
    data: { user },
    message: 'Profile updated successfully'
  });
}

/**
 * The refresh cookie is scoped to /api/auth, so it reaches this route and
 * identifies which session the caller is using. That session is preserved
 * while every other one is revoked. If the cookie is missing or unreadable no
 * session is preserved, which signs the caller out everywhere: the safe
 * outcome rather than leaving unknown sessions alive.
 */
function currentSessionId(request) {
  const token = request.cookies[REFRESH_COOKIE_NAME];
  if (!token) return null;

  try {
    const payload = verifyRefreshToken(token);
    return payload.type === 'refresh' && payload.sub === request.user.id ? payload.sid : null;
  } catch (_error) {
    return null;
  }
}

async function changePassword(request, response) {
  await authService.changeOwnPassword(
    request.user.id,
    request.passwordChangeInput,
    currentSessionId(request)
  );

  response.status(200).json({
    success: true,
    data: null,
    message: 'Password changed successfully. Any other signed-in devices have been signed out.'
  });
}

module.exports = { register, login, refresh, logout, me, updateMe, changePassword };
