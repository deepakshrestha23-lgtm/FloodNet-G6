const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { authenticate, requireRoles } = require('../middleware/auth.middleware');
const { validateConditionsQuery } = require('../validators/conditions.validators');
const conditionsController = require('../controllers/conditions.controller');

const router = express.Router();

/*
 * Operational context for the officers who assess reports and place evacuees.
 * It is read-only and changes nothing, but it stays behind authentication so
 * the deployment is not an open proxy to a third-party service.
 */
router.use(authenticate);
router.use(requireRoles('FLOOD_MONITORING_OFFICER', 'EVACUATION_OFFICER'));

router.get('/', validateConditionsQuery, asyncHandler(conditionsController.getConditions));

module.exports = router;
