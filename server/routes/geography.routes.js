const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const geographyController = require('../controllers/geography.controller');

const router = express.Router();

router.get('/provinces', asyncHandler(geographyController.provinces));
router.get('/districts', asyncHandler(geographyController.districts));
router.get('/local-levels', asyncHandler(geographyController.localLevels));
router.get('/wards', asyncHandler(geographyController.wards));

module.exports = router;
