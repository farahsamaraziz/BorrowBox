const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { idParam } = require('../middleware/validators');
const { updateMe, deleteMe, getPublicProfile } = require('../controllers/users.controller');

const router = Router();

// NOTE: /me routes are declared before /:id so "me" is never treated as an id.

// PUT /api/users/me      (member) - update name, phone, area
router.put(
  '/me',
  requireAuth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.'),
    body('phone').optional({ nullable: true }).isString(),
    body('area').optional({ nullable: true }).isString(),
  ],
  validate,
  updateMe
);

// DELETE /api/users/me   (member) - soft delete, blocked while bookings are open
router.delete('/me', requireAuth, deleteMe);

// GET /api/users/:id     (public) - public profile with trust score and reviews
router.get('/:id', idParam(), validate, getPublicProfile);

module.exports = router;
