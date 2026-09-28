const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/bookings/:id/reviews - rate the other party after RETURNED   (member)
// Each side of a booking can leave one review: the borrower rates the owner and
// the owner rates the borrower (so a booking has at most 2 reviews).
const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const { rows } = await query(
    `SELECT b.id, b.status, b.borrower_id, i.owner_id
     FROM bookings b JOIN items i ON i.id = b.item_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  const booking = rows[0];
  if (!booking) throw ApiError.notFound('Booking not found.');

  const isBorrower = booking.borrower_id === req.user.id;
  const isOwner = booking.owner_id === req.user.id;
  if (!isBorrower && !isOwner) {
    throw ApiError.forbidden('You were not part of this booking.');
  }

  if (booking.status !== 'RETURNED') {
    throw ApiError.conflict('Reviews can only be left after the item has been returned.');
  }

  const already = await query(
    'SELECT 1 FROM reviews WHERE booking_id = $1 AND reviewer_id = $2',
    [booking.id, req.user.id]
  );
  if (already.rows.length > 0) {
    throw ApiError.conflict('You have already reviewed this booking. Edit your existing review instead.');
  }

  const reviewee_id = isBorrower ? booking.owner_id : booking.borrower_id;

  const inserted = await query(
    `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [booking.id, req.user.id, reviewee_id, rating, comment || null]
  );

  res.status(201).json({ review: inserted.rows[0] });
});

async function loadReview(id) {
  const { rows } = await query('SELECT * FROM reviews WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Review not found.');
  return rows[0];
}

// PUT /api/reviews/:id - edit my own rating or comment   (reviewer)
const updateReview = asyncHandler(async (req, res) => {
  const review = await loadReview(req.params.id);
  if (review.reviewer_id !== req.user.id) {
    throw ApiError.forbidden('Only the reviewer can edit this review.');
  }

  const { rating, comment } = req.body;
  const { rows } = await query(
    `UPDATE reviews
     SET rating  = COALESCE($1::int, rating),
         comment = CASE WHEN $3::boolean THEN $2::text ELSE comment END
     WHERE id = $4
     RETURNING *`,
    [rating ?? null, comment === undefined || comment === '' ? null : comment, comment !== undefined, review.id]
  );
  res.json({ review: rows[0] });
});

// DELETE /api/reviews/:id   (reviewer or admin)
const deleteReview = asyncHandler(async (req, res) => {
  const review = await loadReview(req.params.id);
  if (review.reviewer_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the reviewer or an admin can delete this review.');
  }
  await query('DELETE FROM reviews WHERE id = $1', [review.id]);
  res.status(204).send();
});

module.exports = { createReview, updateReview, deleteReview };
