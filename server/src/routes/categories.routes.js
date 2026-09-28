const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { idParam } = require('../middleware/validators');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categories.controller');

const router = Router();
const nameRule = body('name').trim().notEmpty().withMessage('Category name is required.');

router.get('/', listCategories);                                                                        // public
router.post('/', requireAuth, requireRole('admin'), [nameRule], validate, createCategory);              // admin
router.put('/:id', requireAuth, requireRole('admin'), idParam(), [nameRule], validate, updateCategory);  // admin
router.delete('/:id', requireAuth, requireRole('admin'), idParam(), validate, deleteCategory);           // admin

module.exports = router;
