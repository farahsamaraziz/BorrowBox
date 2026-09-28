const { Router } = require('express');
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { idParam, dateQuery } = require('../middleware/validators');
const {
  listItems,
  listMyItems,
  getItem,
  getAvailability,
  createItem,
  updateItem,
  deleteItem,
} = require('../controllers/items.controller');

const router = Router();

const CONDITIONS = ['new', 'good', 'fair'];

// GET /api/items?search=&category=&from=&to=&page=   (public)
router.get(
  '/',
  [
    dateQuery('from'),
    dateQuery('to'),
    query('condition').optional().isIn(CONDITIONS).withMessage(`condition must be one of: ${CONDITIONS.join(', ')}.`),
  ],
  validate,
  listItems
);

// GET /api/items/mine (member) - must be declared BEFORE /:id
router.get('/mine', requireAuth, listMyItems);

router.get('/:id', idParam(), validate, getItem);                        // public
router.get('/:id/availability', idParam(), validate, getAvailability);   // public

router.post(
  '/',
  requireAuth,
  [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('category_id').isInt({ min: 1 }).withMessage('category_id must be an integer.').toInt(),
    body('condition').optional().isIn(CONDITIONS).withMessage(`condition must be one of: ${CONDITIONS.join(', ')}.`),
    body('max_days').isInt({ min: 1 }).withMessage('max_days must be a positive integer.').toInt(),
    body('description').optional({ checkFalsy: true }).isString(),
    body('pickup_area').optional({ checkFalsy: true }).isString(),
    body('image_url').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  createItem
);

router.put(
  '/:id',
  requireAuth,
  idParam(),
  [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty.'),
    body('category_id').optional().isInt({ min: 1 }).toInt(),
    body('condition').optional().isIn(CONDITIONS).withMessage(`condition must be one of: ${CONDITIONS.join(', ')}.`),
    body('max_days').optional().isInt({ min: 1 }).withMessage('max_days must be a positive integer.').toInt(),
    body('description').optional({ nullable: true }).isString(),
    body('pickup_area').optional({ nullable: true }).isString(),
    body('image_url').optional({ nullable: true }).isString(),
    body('is_active').optional().isBoolean().toBoolean(),
  ],
  validate,
  updateItem
);

router.delete('/:id', requireAuth, idParam(), validate, deleteItem);

module.exports = router;
