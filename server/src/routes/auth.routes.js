const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { register, login, getMe } = require('../controllers/auth.controller');

const router = Router();

// POST /api/auth/register   (public)
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('phone').optional({ checkFalsy: true }).isString(),
    body('area').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  register
);

// POST /api/auth/login      (public)
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  login
);

// GET /api/auth/me          (member)
router.get('/me', requireAuth, getMe);

module.exports = router;
