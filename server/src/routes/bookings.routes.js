const { Router } = require('express');
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { idParam, dateBody } = require('../middleware/validators');
const {
  ACTION_NAMES,
  BOOKING_STATUSES,
  createBooking,
  listMyBorrowings,
  listIncomingRequests,
  getBooking,
  updateBooking,
  changeStatus,
  deleteBooking,
} = require('../controllers/bookings.controller');
const { createReview } = require('../controllers/reviews.controller');

const router = Router();

router.use(requireAuth);

const statusFilter = query('status')
  .optional({ checkFalsy: true })
  .isIn(BOOKING_STATUSES)
  .withMessage(`status must be one of: ${BOOKING_STATUSES.join(', ')}.`);

// POST /api/bookings - create request (runs all business rules)
router.post(
  '/',
  [
    body('item_id').isInt({ min: 1 }).withMessage('item_id is required.').toInt(),
    dateBody('start_date'),
    dateBody('end_date'),
    body('message').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  createBooking
);

// GET /api/bookings/mine and /incoming - declared BEFORE /:id
router.get('/mine', [statusFilter], validate, listMyBorrowings);
router.get('/incoming', [statusFilter], validate, listIncomingRequests);

// GET /api/bookings/:id - booking details with condition logs
router.get('/:id', idParam(), validate, getBooking);

// PUT /api/bookings/:id - edit dates or message while REQUESTED
router.put(
  '/:id',
  idParam(),
  [
    dateBody('start_date', { optional: true }),
    dateBody('end_date', { optional: true }),
    body('message').optional({ nullable: true }).isString(),
  ],
  validate,
  updateBooking
);

// DELETE /api/bookings/:id - remove a REJECTED or CANCELLED booking
router.delete('/:id', idParam(), validate, deleteBooking);

// PATCH /api/bookings/:id/status - { action: approve|reject|cancel|pickup|return, note }
router.patch(
  '/:id/status',
  idParam(),
  [
    body('action').isIn(ACTION_NAMES).withMessage(`action must be one of: ${ACTION_NAMES.join(', ')}.`),
    body('note').optional({ nullable: true }).isString().withMessage('note must be text.'),
    body('note')
      .if(body('action').isIn(['pickup', 'return']))
      .trim()
      .notEmpty()
      .withMessage('A condition note is required for pickup and return.'),
  ],
  validate,
  changeStatus
);

// POST /api/bookings/:id/reviews - rating + comment after RETURNED
router.post(
  '/:id/reviews',
  idParam(),
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be a whole number from 1 to 5.').toInt(),
    body('comment').optional({ checkFalsy: true }).isString(),
  ],
  validate,
  createReview
);

module.exports = router;
