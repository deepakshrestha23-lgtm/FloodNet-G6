const { AppError } = require('../utils/http-error');
const { hashPassword } = require('../utils/password');
const adminRepository = require('../repositories/admin.repository');
const centreRepository = require('../repositories/centre.repository');
const jurisdictionRepository = require('../repositories/jurisdiction.repository');

const ASSIGNABLE_ROLES = new Set([
  'RESIDENT',
  'FLOOD_MONITORING_OFFICER',
  'EVACUATION_OFFICER',
  'ADMINISTRATOR'
]);

async function listUsers(query) {
  return adminRepository.listUsers(query);
}

async function getUser(userId) {
  const user = await adminRepository.findUserById(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'The requested user was not found');
  }

  return user;
}

async function listRoles() {
  return adminRepository.listRoles();
}

async function createStaffUser(admin, input) {
  if (!ASSIGNABLE_ROLES.has(input.roleCode)) {
    throw new AppError(400, 'INVALID_ROLE', 'The selected role is not assignable');
  }

  if (input.jurisdiction && !['FLOOD_MONITORING_OFFICER', 'EVACUATION_OFFICER'].includes(input.roleCode)) {
    throw new AppError(400, 'JURISDICTION_ROLE_MISMATCH', 'Geographic jurisdictions are intended for operational officer accounts');
  }

  if (input.jurisdiction) {
    const targetId = input.jurisdiction.scopeLevel === 'NATIONAL'
      ? null
      : input.jurisdiction[{
          PROVINCE: 'provinceId',
          DISTRICT: 'districtId',
          LOCAL_LEVEL: 'localLevelId',
          WARD: 'wardId'
        }[input.jurisdiction.scopeLevel]];

    if (!(await jurisdictionRepository.isValidScopeTarget(input.jurisdiction.scopeLevel, targetId))) {
      throw new AppError(400, 'INVALID_JURISDICTION_TARGET', 'The selected geographic target is invalid or inactive');
    }
  }

  const passwordHash = await hashPassword(input.password);

  let result;
  try {
    result = await adminRepository.createStaffUser({
      actorId: admin.id,
      email: input.email,
      passwordHash,
      roleCode: input.roleCode,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      jurisdiction: input.jurisdiction
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with that email address already exists');
    }

    throw error;
  }

  if (result.outcome === 'INVALID_ROLE') {
    throw new AppError(400, 'INVALID_ROLE', 'The selected role is not assignable');
  }

  return adminRepository.findUserById(result.userId);
}

async function updateUserJurisdiction(admin, userId, input) {
  const target = await getUser(userId);
  if (!['FLOOD_MONITORING_OFFICER', 'EVACUATION_OFFICER'].includes(target.role.code)) {
    throw new AppError(400, 'JURISDICTION_ROLE_MISMATCH', 'Geographic jurisdictions are intended for operational officer accounts');
  }

  const targetId = input.scopeLevel === 'NATIONAL'
    ? null
    : input[{
        PROVINCE: 'provinceId',
        DISTRICT: 'districtId',
        LOCAL_LEVEL: 'localLevelId',
        WARD: 'wardId'
      }[input.scopeLevel]];

  if (!(await jurisdictionRepository.isValidScopeTarget(input.scopeLevel, targetId))) {
    throw new AppError(400, 'INVALID_JURISDICTION_TARGET', 'The selected geographic target is invalid or inactive');
  }

  const updated = await adminRepository.updateUserJurisdiction({
    actorId: admin.id,
    userId,
    jurisdiction: input
  });
  if (!updated) throw new AppError(404, 'USER_NOT_FOUND', 'The requested user was not found');
  return adminRepository.findUserById(userId);
}

/**
 * An administrator resets another account's password.
 *
 * Resetting your own password this way is refused: it would set a new
 * credential without proving you know the current one, which would let anyone
 * holding a stolen administrator access token lock the real owner out. The
 * self-service endpoint, which does require the current password, is the only
 * route to your own credential.
 */
async function resetUserPassword(admin, userId, newPassword) {
  if (admin.id === userId) {
    throw new AppError(
      409,
      'SELF_PASSWORD_RESET_FORBIDDEN',
      'Change your own password from your profile, where your current password is required'
    );
  }

  await getUser(userId);

  const passwordHash = await hashPassword(newPassword);
  const updated = await adminRepository.resetUserPassword({
    actorId: admin.id,
    userId,
    passwordHash
  });

  if (!updated) throw new AppError(404, 'USER_NOT_FOUND', 'The requested user was not found');

  return adminRepository.findUserById(userId);
}

/**
 * An administrator cannot deactivate their own account, and the last active
 * administrator cannot be deactivated at all, so the platform can never be
 * locked out of administrative access.
 */
async function updateUserStatus(admin, userId, status) {
  if (admin.id === userId && status === 'INACTIVE') {
    throw new AppError(409, 'SELF_DEACTIVATION_FORBIDDEN', 'You cannot deactivate your own account');
  }

  const target = await getUser(userId);

  if (target.role.code === 'ADMINISTRATOR' && status === 'INACTIVE') {
    const remainingAdministrators = await adminRepository.countActiveAdministrators(userId);

    if (remainingAdministrators === 0) {
      throw new AppError(
        409,
        'LAST_ADMINISTRATOR',
        'The last active administrator cannot be deactivated'
      );
    }
  }

  const user = await adminRepository.updateUserStatus({ actorId: admin.id, userId, status });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'The requested user was not found');
  }

  return user;
}

/**
 * Administrators cannot change their own role, which prevents an accidental or
 * deliberate self-demotion from removing the last administrator.
 */
async function updateUserRole(admin, userId, roleCode) {
  if (!ASSIGNABLE_ROLES.has(roleCode)) {
    throw new AppError(400, 'INVALID_ROLE', 'The selected role is not assignable');
  }

  if (admin.id === userId) {
    throw new AppError(409, 'SELF_ROLE_CHANGE_FORBIDDEN', 'You cannot change your own role');
  }

  const target = await getUser(userId);

  if (target.role.code === 'ADMINISTRATOR' && roleCode !== 'ADMINISTRATOR') {
    const remainingAdministrators = await adminRepository.countActiveAdministrators(userId);

    if (remainingAdministrators === 0) {
      throw new AppError(
        409,
        'LAST_ADMINISTRATOR',
        'The last active administrator cannot be moved to another role'
      );
    }
  }

  const result = await adminRepository.updateUserRole({ actorId: admin.id, userId, roleCode });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError(404, 'USER_NOT_FOUND', 'The requested user was not found');
  }

  if (result.outcome === 'INVALID_ROLE') {
    throw new AppError(400, 'INVALID_ROLE', 'The selected role is not assignable');
  }

  return adminRepository.findUserById(userId);
}

async function listZones(query) {
  return adminRepository.listZones(query);
}

async function createZone(admin, input) {
  try {
    const zoneId = await adminRepository.createZone({
      actorId: admin.id,
      code: input.code,
      name: input.name,
      locality: input.locality,
      description: input.description
    });

    return adminRepository.findZoneById(zoneId);
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'ZONE_CODE_IN_USE', 'A flood zone with that code already exists');
    }

    throw error;
  }
}

/**
 * A zone that still has active evacuation centres cannot be deactivated,
 * because residents would otherwise be directed to centres in a zone the
 * platform no longer treats as operational.
 */
async function updateZone(admin, zoneId, input) {
  const existing = await adminRepository.findZoneById(zoneId);

  if (!existing) {
    throw new AppError(404, 'ZONE_NOT_FOUND', 'The requested flood zone was not found');
  }

  if (existing.isActive && input.isActive === false) {
    const activeCentres = await adminRepository.countActiveCentresInZone(zoneId);

    if (activeCentres > 0) {
      throw new AppError(
        409,
        'ZONE_HAS_ACTIVE_CENTRES',
        `This zone still has ${activeCentres} active evacuation centre(s). Archive them before deactivating the zone.`
      );
    }
  }

  const updatedId = await adminRepository.updateZone({
    actorId: admin.id,
    zoneId,
    name: input.name,
    locality: input.locality,
    description: input.description,
    isActive: input.isActive
  });

  if (!updatedId) {
    throw new AppError(404, 'ZONE_NOT_FOUND', 'The requested flood zone was not found');
  }

  return adminRepository.findZoneById(zoneId);
}

async function listFacilityTypes() {
  return centreRepository.listFacilityTypes({ includeInactive: true });
}

async function saveFacilityType(admin, input) {
  try {
    const facilityTypeId = await adminRepository.upsertFacilityType({
      actorId: admin.id,
      facilityTypeId: input.facilityTypeId,
      code: input.code,
      displayName: input.displayName,
      isActive: input.isActive
    });

    if (!facilityTypeId) {
      throw new AppError(404, 'FACILITY_TYPE_NOT_FOUND', 'The requested facility type was not found');
    }

    return (await centreRepository.listFacilityTypes({ includeInactive: true }))
      .find((facilityType) => facilityType.id === facilityTypeId);
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'FACILITY_CODE_IN_USE', 'A facility type with that code already exists');
    }

    throw error;
  }
}

async function listAuditLogs(query) {
  return adminRepository.listAuditLogs(query);
}

async function listAuditActions() {
  return adminRepository.listAuditActions();
}

async function getOverview() {
  return adminRepository.getAdminOverview();
}

module.exports = {
  ASSIGNABLE_ROLES,
  listUsers,
  getUser,
  listRoles,
  createStaffUser,
  updateUserStatus,
  updateUserRole,
  updateUserJurisdiction,
  resetUserPassword,
  listZones,
  createZone,
  updateZone,
  listFacilityTypes,
  saveFacilityType,
  listAuditLogs,
  listAuditActions,
  getOverview
};
