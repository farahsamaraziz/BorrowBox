const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { idParam } = require('../middleware/validators');
const { updateReview, deleteReview } = require('../controllers/reviews.controller');

const router = Router();

router.use(requireAuth);

// (Reviews are created via POST /api/bookings/:id/reviews)

// PUT /api/reviews/:id - reviewer edits own rating or comment
router.put(
  '/:id',
  idParam(),
  [
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('rating must be a whole number from 1 to 5.').toInt(),
    body('comment').optional({ nullable: true }).isString(),
  ],
  validate,
  updateReview
);

// DELETE /api/reviews/:id - reviewer or admin
router.delete('/:id', idParam(), validate, deleteReview);

module.exports = router;
