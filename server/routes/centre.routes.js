const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { authenticate, requireRoles } = require('../middleware/auth.middleware');
const {
  validateCentreBody,
  validateOccupancyBody,
  validateStatusBody,
  validateCentreListQuery,
  validateCentreId
} = require('../validators/centre.validators');
const centreController = require('../controllers/centre.controller');
const { validateGeographyQuery } = require('../validators/geography.validators');

const router = express.Router();

router.use(authenticate);

const requireEvacuationOfficer = requireRoles('EVACUATION_OFFICER');

// Any signed-in user may read centre information so residents and flood
// monitoring officers can see where capacity is available. Only the Evacuation
// Officer may change it.
router.get('/dashboard', validateGeographyQuery, asyncHandler(centreController.dashboard));
router.get('/facility-types', asyncHandler(centreController.facilityTypes));
/*
 * Live alerts for the officer's own jurisdiction, read only. Declared before
 * the ":id" routes so "alerts" is not parsed as a centre identifier.
 *
 * The evacuation officer decides when to open a shelter and needs to see the
 * warning that makes that necessary. Creating and publishing alerts stays with
 * the monitoring officer.
 */
router.get('/alerts', requireEvacuationOfficer, asyncHandler(centreController.listActiveAlerts));
router.get('/incidents', requireEvacuationOfficer, asyncHandler(centreController.listVerifiedIncidents));

router.get('/', validateCentreListQuery, asyncHandler(centreController.list));
router.get('/:id', validateCentreId, asyncHandler(centreController.get));

router.post('/', requireEvacuationOfficer, validateCentreBody, asyncHandler(centreController.create));
router.patch('/:id', requireEvacuationOfficer, validateCentreId, validateCentreBody, asyncHandler(centreController.update));
router.post('/:id/occupancy', requireEvacuationOfficer, validateCentreId, validateOccupancyBody, asyncHandler(centreController.updateOccupancy));
router.post('/:id/status', requireEvacuationOfficer, validateCentreId, validateStatusBody, asyncHandler(centreController.updateStatus));
router.post('/:id/archive', requireEvacuationOfficer, validateCentreId, asyncHandler(centreController.archive));

module.exports = router;
