const express = require('express');
const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('../utils/async-handler');
const { authenticate } = require('../middleware/auth.middleware');
const {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange
} = require('../validators/auth.validators');
const authController = require('../controllers/auth.controller');

const router = express.Router();

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again later.'
      }
    });
  }
});

router.post('/register', authenticationLimiter, validateRegister, asyncHandler(authController.register));
router.post('/login', authenticationLimiter, validateLogin, asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, validateProfileUpdate, asyncHandler(authController.updateMe));
// Rate limited with the other credential routes: it verifies a password, so it
// is as attractive to brute force as login is.
router.patch(
  '/me/password',
  authenticationLimiter,
  authenticate,
  validatePasswordChange,
  asyncHandler(authController.changePassword)
);

module.exports = router;
