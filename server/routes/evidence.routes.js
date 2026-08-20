const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const { authenticate } = require('../middleware/auth.middleware');
const {
  validateEvidenceComplete,
  validateEvidenceReportId,
  validateEvidenceId
} = require('../validators/evidence.validators');
const evidenceController = require('../controllers/evidence.controller');
const { uploadEvidenceFiles } = require('../middleware/evidence-upload.middleware');

const router = express.Router();

router.use(authenticate);
router.post('/:id/evidence', validateEvidenceReportId, uploadEvidenceFiles, asyncHandler(evidenceController.upload));
router.post('/:id/evidence/session', validateEvidenceReportId, asyncHandler(evidenceController.session));
router.get('/:id/evidence/:evidenceId/url', validateEvidenceReportId, validateEvidenceId, asyncHandler(evidenceController.access));
router.get('/:id/evidence', validateEvidenceReportId, asyncHandler(evidenceController.list));
router.post('/:id/evidence/complete', validateEvidenceReportId, validateEvidenceComplete, asyncHandler(evidenceController.complete));

module.exports = router;
