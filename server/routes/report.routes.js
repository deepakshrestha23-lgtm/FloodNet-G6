const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { authenticate, requireRoles } = require('../middleware/auth.middleware');
const {
  validateCreateReport,
  validateUpdateReport,
  validateReportListQuery,
  validateReportId
} = require('../validators/report.validators');
const reportController = require('../controllers/report.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireRoles('RESIDENT'));
router.post('/', validateCreateReport, asyncHandler(reportController.create));
router.get('/mine', validateReportListQuery, asyncHandler(reportController.listMine));
router.get('/:id/history', validateReportId, asyncHandler(reportController.getHistory));
router.get('/:id', validateReportId, asyncHandler(reportController.getMine));
router.patch('/:id', validateReportId, validateUpdateReport, asyncHandler(reportController.update));

module.exports = router;
