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

const router = express.Router();

router.use(authenticate);

const requireEvacuationOfficer = requireRoles('EVACUATION_OFFICER');

// Any signed-in user may read centre information so residents and flood
// monitoring officers can see where capacity is available. Only the Evacuation
// Officer may change it.
router.get('/dashboard', asyncHandler(centreController.dashboard));
router.get('/facility-types', asyncHandler(centreController.facilityTypes));
router.get('/', validateCentreListQuery, asyncHandler(centreController.list));
router.get('/:id', validateCentreId, asyncHandler(centreController.get));

router.post('/', requireEvacuationOfficer, validateCentreBody, asyncHandler(centreController.create));
router.patch('/:id', requireEvacuationOfficer, validateCentreId, validateCentreBody, asyncHandler(centreController.update));
router.post('/:id/occupancy', requireEvacuationOfficer, validateCentreId, validateOccupancyBody, asyncHandler(centreController.updateOccupancy));
router.post('/:id/status', requireEvacuationOfficer, validateCentreId, validateStatusBody, asyncHandler(centreController.updateStatus));
router.post('/:id/archive', requireEvacuationOfficer, validateCentreId, asyncHandler(centreController.archive));

module.exports = router;
