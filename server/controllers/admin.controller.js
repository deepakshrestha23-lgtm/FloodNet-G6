const adminService = require('../services/admin.service');

async function listUsers(request, response) {
  const result = await adminService.listUsers(request.userQuery);

  response.status(200).json({
    success: true,
    data: {
      users: result.users,
      pagination: {
        total: result.total,
        limit: request.userQuery.limit,
        offset: request.userQuery.offset
      }
    },
    message: 'Users retrieved successfully'
  });
}

async function getUser(request, response) {
  const user = await adminService.getUser(request.params.id);

  response.status(200).json({
    success: true,
    data: { user },
    message: 'User retrieved successfully'
  });
}

async function createUser(request, response) {
  const user = await adminService.createStaffUser(request.user, request.staffUserInput);

  response.status(201).json({
    success: true,
    data: { user },
    message: 'User account created successfully'
  });
}

async function updateUserStatus(request, response) {
  const user = await adminService.updateUserStatus(
    request.user,
    request.params.id,
    request.statusInput.status
  );

  response.status(200).json({
    success: true,
    data: { user },
    message: 'User status updated successfully'
  });
}

async function updateUserRole(request, response) {
  const user = await adminService.updateUserRole(
    request.user,
    request.params.id,
    request.roleInput.roleCode
  );

  response.status(200).json({
    success: true,
    data: { user },
    message: 'User role updated successfully'
  });
}

async function listRoles(_request, response) {
  const roles = await adminService.listRoles();

  response.status(200).json({
    success: true,
    data: { roles },
    message: 'Roles retrieved successfully'
  });
}

async function listZones(request, response) {
  const zones = await adminService.listZones({
    includeInactive: request.query.includeInactive !== 'false'
  });

  response.status(200).json({
    success: true,
    data: { zones },
    message: 'Flood zones retrieved successfully'
  });
}

async function createZone(request, response) {
  const zone = await adminService.createZone(request.user, request.zoneInput);

  response.status(201).json({
    success: true,
    data: { zone },
    message: 'Flood zone created successfully'
  });
}

async function updateZone(request, response) {
  const zone = await adminService.updateZone(request.user, request.params.id, request.zoneInput);

  response.status(200).json({
    success: true,
    data: { zone },
    message: 'Flood zone updated successfully'
  });
}

async function listFacilityTypes(_request, response) {
  const facilityTypes = await adminService.listFacilityTypes();

  response.status(200).json({
    success: true,
    data: { facilityTypes },
    message: 'Facility types retrieved successfully'
  });
}

async function saveFacilityType(request, response) {
  const facilityType = await adminService.saveFacilityType(request.user, request.facilityTypeInput);

  response.status(200).json({
    success: true,
    data: { facilityType },
    message: 'Facility type saved successfully'
  });
}

async function listAuditLogs(request, response) {
  const result = await adminService.listAuditLogs(request.auditQuery);

  response.status(200).json({
    success: true,
    data: {
      entries: result.entries,
      pagination: {
        total: result.total,
        limit: request.auditQuery.limit,
        offset: request.auditQuery.offset
      }
    },
    message: 'Audit entries retrieved successfully'
  });
}

async function listAuditActions(_request, response) {
  const actions = await adminService.listAuditActions();

  response.status(200).json({
    success: true,
    data: { actions },
    message: 'Audit actions retrieved successfully'
  });
}

async function overview(_request, response) {
  const data = await adminService.getOverview();

  response.status(200).json({
    success: true,
    data,
    message: 'Administration overview retrieved successfully'
  });
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUserStatus,
  updateUserRole,
  listRoles,
  listZones,
  createZone,
  updateZone,
  listFacilityTypes,
  saveFacilityType,
  listAuditLogs,
  listAuditActions,
  overview
};
