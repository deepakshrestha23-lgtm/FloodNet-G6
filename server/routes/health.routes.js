const express = require('express');
const {
  getHealth,
  getDatabaseHealth
} = require('../controllers/health.controller');

const router = express.Router();

router.get('/', getHealth);
router.get('/db', getDatabaseHealth);

module.exports = router;
