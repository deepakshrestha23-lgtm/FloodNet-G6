const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { authenticate, requireRoles } = require('../middleware/auth.middleware');
const {
  validateReportQueueQuery,
  validateReviewDecision,
  validateAlertBody,
  validateAlertListQuery,
  validateResourceId
} = require('../validators/officer.validators');
const officerController = require('../controllers/officer.controller');
const { validateGeographyQuery } = require('../validators/geography.validators');

const router = express.Router();

// Every route below is operational flood monitoring work. Administrators are
// deliberately excluded so report verification and alert publishing stay with
// the authorized Flood Monitoring Officer role.
router.use(authenticate);
router.use(requireRoles('FLOOD_MONITORING_OFFICER'));

const validateReportId = validateResourceId('id', 'report identifier');
const validateAlertId = validateResourceId('id', 'alert identifier');

router.get('/dashboard', validateGeographyQuery, asyncHandler(officerController.dashboard));

router.get('/reports', validateReportQueueQuery, asyncHandler(officerController.listReports));
router.get('/reports/:id', validateReportId, asyncHandler(officerController.getReport));
router.get(
  '/reports/:id/evidence/:evidenceId/url',
  validateReportId,
  validateResourceId('evidenceId', 'evidence identifier'),
  asyncHandler(officerController.evidenceUrl)
);
router.post('/reports/:id/review', validateReportId, validateReviewDecision, asyncHandler(officerController.reviewReport));

router.get('/alerts', validateAlertListQuery, asyncHandler(officerController.listAlerts));
router.post('/alerts', validateAlertBody, asyncHandler(officerController.createAlert));
router.get('/alerts/:id', validateAlertId, asyncHandler(officerController.getAlert));
router.patch('/alerts/:id', validateAlertId, validateAlertBody, asyncHandler(officerController.updateAlert));
router.post('/alerts/:id/publish', validateAlertId, asyncHandler(officerController.publishAlert));
router.post('/alerts/:id/expire', validateAlertId, asyncHandler(officerController.expireAlert));
router.post('/alerts/:id/cancel', validateAlertId, asyncHandler(officerController.cancelAlert));

module.exports = router;
