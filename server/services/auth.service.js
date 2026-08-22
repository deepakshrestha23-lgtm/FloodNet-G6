const crypto = require('crypto');
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken,
  REFRESH_TOKEN_MAX_AGE_MS
} = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/password');
const { AppError } = require('../utils/http-error');
const userRepository = require('../repositories/user.repository');
const sessionRepository = require('../repositories/session.repository');

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    role: {
      code: user.roleCode,
      displayName: user.roleDisplayName
    },
    profile: user.profile,
    jurisdiction: user.jurisdiction,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

async function registerResident(input) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await userRepository.createResident({
      email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone?.trim() || null,
      homeZoneId: input.homeZoneId || null,
      homeWardId: input.homeWardId || null
    });

    return toPublicUser(user);
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    }

    if (error.code === 'INVALID_HOME_ZONE') {
      throw new AppError(400, 'INVALID_HOME_ZONE', error.message);
    }

    if (error.code === 'INVALID_HOME_WARD') {
      throw new AppError(400, 'INVALID_HOME_WARD', error.message);
    }

    throw error;
  }
}

async function login(emailInput, password) {
  const email = normalizeEmail(emailInput);
  const user = await userRepository.findUserByEmail(email);

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  await userRepository.updateLastLogin(user.id);

  const sessionId = crypto.randomUUID();
  const refreshToken = createRefreshToken(user.id, sessionId);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

  await sessionRepository.createSession({
    id: sessionId,
    userId: user.id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken,
    user: toPublicUser({ ...user, lastLoginAt: new Date().toISOString() })
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new AppError(401, 'REFRESH_TOKEN_REQUIRED', 'A refresh token is required');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_error) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired');
  }

  if (payload.type !== 'refresh' || !payload.sid || !payload.sub) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid');
  }

  const newRefreshToken = createRefreshToken(payload.sub, payload.sid);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
  const session = await sessionRepository.rotateSessionAtomically(
    payload.sid,
    hashToken(refreshToken),
    hashToken(newRefreshToken),
    expiresAt
  );

  if (!session || session.user_id !== payload.sub) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or revoked');
  }

  const user = await userRepository.findUserById(payload.sub);

  if (!user || user.status !== 'ACTIVE') {
    await sessionRepository.revokeSession(payload.sid);
    throw new AppError(401, 'ACCOUNT_INACTIVE', 'This account is inactive');
  }

  return {
    accessToken: createAccessToken(user),
    // Only the request that performed the rotation sets a new cookie. A
    // concurrent request accepted through the grace window must not overwrite
    // that cookie with an older token.
    refreshToken: session.matchedPrevious ? null : newRefreshToken,
    user: toPublicUser(user)
  };
}

async function logout(refreshToken) {
  if (!refreshToken) return;

  try {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.sid) {
      await sessionRepository.revokeSession(payload.sid);
    }
  } catch (_error) {
    // Logout remains successful even when the cookie is already expired or invalid.
  }
}

/**
 * Changes the caller's own password after re-verifying the current one.
 *
 * The failure for a wrong current password is deliberately the same
 * INVALID_CREDENTIALS used by login, so this endpoint cannot be used to probe
 * whether a guessed password is correct any more cheaply than login can.
 */
async function changeOwnPassword(userId, { currentPassword, newPassword }, currentSessionId = null) {
  const user = await userRepository.findUserById(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User account not found');
  }

  const passwordMatches = await comparePassword(currentPassword, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Your current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await userRepository.updatePassword(userId, passwordHash, {
    keepSessionId: currentSessionId
  });

  if (!updated) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User account not found');
  }
}

async function updateCurrentUser(userId, input) {
  if (input.homeZoneId) {
    const validZone = await userRepository.isActiveZone(input.homeZoneId);
    if (!validZone) {
      throw new AppError(400, 'INVALID_HOME_ZONE', 'The selected home zone is invalid or inactive');
    }
  }

  // The home ward is the administrative location alerts are targeted at, so an
  // inactive or unknown ward is rejected rather than quietly stored.
  if (input.homeWardId) {
    const validWard = await userRepository.isActiveWard(input.homeWardId);
    if (!validWard) {
      throw new AppError(400, 'INVALID_HOME_WARD', 'The selected home ward is invalid or inactive');
    }
  }

  const user = await userRepository.updateProfile(userId, {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || null,
    homeZoneId: input.homeZoneId || null,
    homeWardId: input.homeWardId || null
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User account not found');
  }

  return toPublicUser(user);
}

module.exports = {
  registerResident,
  login,
  refresh,
  logout,
  toPublicUser,
  updateCurrentUser,
  changeOwnPassword
};
