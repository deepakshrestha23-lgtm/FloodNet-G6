const express = require('express');
const { asyncHandler } = require('../utils/async-handler');
const publicController = require('../controllers/public.controller');

const router = express.Router();

router.get('/zones', asyncHandler(publicController.zones));
router.get('/alerts', asyncHandler(publicController.alerts));
router.get('/incidents', asyncHandler(publicController.incidents));
router.get('/centres', asyncHandler(publicController.centres));

module.exports = router;
