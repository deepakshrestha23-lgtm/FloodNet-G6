const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { authenticate, requireRoles } = require('../middleware/auth.middleware');
const {
  validateUserListQuery,
  validateStaffUserBody,
  validateUserStatusBody,
  validateUserRoleBody,
  validateJurisdictionBody,
  validateZoneBody,
  validateFacilityTypeBody,
  validateAuditQuery,
  validateResourceId
} = require('../validators/admin.validators');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

// System governance only. Administrators deliberately have no route here for
// reviewing reports or publishing alerts; those stay with the operational
// officer roles.
router.use(authenticate);
router.use(requireRoles('ADMINISTRATOR'));

const validateUserId = validateResourceId('id', 'user identifier');
const validateZoneId = validateResourceId('id', 'zone identifier');

router.get('/overview', asyncHandler(adminController.overview));

router.get('/users', validateUserListQuery, asyncHandler(adminController.listUsers));
router.post('/users', validateStaffUserBody, asyncHandler(adminController.createUser));
router.get('/users/:id', validateUserId, asyncHandler(adminController.getUser));
router.patch('/users/:id/status', validateUserId, validateUserStatusBody, asyncHandler(adminController.updateUserStatus));
router.patch('/users/:id/role', validateUserId, validateUserRoleBody, asyncHandler(adminController.updateUserRole));
router.patch('/users/:id/jurisdiction', validateUserId, validateJurisdictionBody, asyncHandler(adminController.updateUserJurisdiction));

router.get('/roles', asyncHandler(adminController.listRoles));

router.get('/zones', asyncHandler(adminController.listZones));
router.post('/zones', validateZoneBody, asyncHandler(adminController.createZone));
router.patch('/zones/:id', validateZoneId, validateZoneBody, asyncHandler(adminController.updateZone));

router.get('/facility-types', asyncHandler(adminController.listFacilityTypes));
router.post('/facility-types', validateFacilityTypeBody, asyncHandler(adminController.saveFacilityType));

router.get('/audit', validateAuditQuery, asyncHandler(adminController.listAuditLogs));
router.get('/audit/actions', asyncHandler(adminController.listAuditActions));

module.exports = router;
