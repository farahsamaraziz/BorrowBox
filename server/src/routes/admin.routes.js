const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { idParam } = require('../middleware/validators');
const { listUsers, setUserStatus, getStats } = require('../controllers/admin.controller');

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/users', listUsers);              // GET /api/admin/users
router.patch(
  '/users/:id/status',
  idParam(),
  [body('is_active').isBoolean().withMessage('is_active must be true or false.')],
  validate,
  setUserStatus
);
router.get('/stats', getStats);              // GET /api/admin/stats

module.exports = router;
