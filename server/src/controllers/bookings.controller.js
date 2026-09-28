const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/bookingService');

const { ACTION_NAMES, BOOKING_STATUSES, IS_OVERDUE } = service;

// HTTP layer only: read the request, call bookingService for anything that changes
// data, shape the response. The rules and the state machine live in the service.

// POST /api/bookings - borrower sends a request
const createBooking = asyncHandler(async (req, res) => {
  const booking = await service.createBooking(req.user.id, req.body);
  res.status(201).json({ booking });
});

// ---------------------------------------------------------------------
// GET /api/bookings/mine - my borrowings  (borrower)
// GET /api/bookings/incoming - requests on items I own  (owner)
// Both carry the computed is_overdue flag for the dashboard.
// ---------------------------------------------------------------------
const listMyBorrowings = asyncHandler(async (req, res) => {
  const params = [req.user.id];
  let statusClause = '';
  if (req.query.status) {
    params.push(req.query.status);
    statusClause = `AND b.status = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT b.*, ${IS_OVERDUE} AS is_overdue,
            i.title AS item_title, i.image_url, i.owner_id, u.name AS owner_name
     FROM bookings b
     JOIN items i ON i.id = b.item_id
     JOIN users u ON u.id = i.owner_id
     WHERE b.borrower_id = $1 ${statusClause}
     ORDER BY b.created_at DESC, b.id DESC`,
    params
  );
  res.json({ bookings: rows });
});

const listIncomingRequests = asyncHandler(async (req, res) => {
  const params = [req.user.id];
  let statusClause = '';
  if (req.query.status) {
    params.push(req.query.status);
    statusClause = `AND b.status = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT b.*, ${IS_OVERDUE} AS is_overdue,
            i.title AS item_title, i.image_url, u.name AS borrower_name
     FROM bookings b
     JOIN items i ON i.id = b.item_id
     JOIN users u ON u.id = b.borrower_id
     WHERE i.owner_id = $1 ${statusClause}
     ORDER BY b.created_at DESC, b.id DESC`,
    params
  );
  res.json({ bookings: rows });
});

// ---------------------------------------------------------------------
// GET /api/bookings/:id - details with condition logs  (borrower / owner)
// Reviews for the booking come along so the page needs a single request.
// ---------------------------------------------------------------------
const getBooking = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT b.*, ${IS_OVERDUE} AS is_overdue,
            i.owner_id, i.title AS item_title, i.max_days, i.image_url,
            o.name AS owner_name, bu.name AS borrower_name
     FROM bookings b
     JOIN items i  ON i.id  = b.item_id
     JOIN users o  ON o.id  = i.owner_id
     JOIN users bu ON bu.id = b.borrower_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  const booking = rows[0];
  if (!booking) throw ApiError.notFound('Booking not found.');
  if (booking.borrower_id !== req.user.id && booking.owner_id !== req.user.id) {
    throw ApiError.forbidden('You are not part of this booking.');
  }

  const [logs, reviews] = await Promise.all([
    query(
      `SELECT cl.*, u.name AS logged_by_name
       FROM condition_logs cl JOIN users u ON u.id = cl.logged_by
       WHERE cl.booking_id = $1
       ORDER BY cl.logged_at ASC, cl.id ASC`,
      [booking.id]
    ),
    query(
      `SELECT r.*, u.name AS reviewer_name
       FROM reviews r JOIN users u ON u.id = r.reviewer_id
       WHERE r.booking_id = $1
       ORDER BY r.created_at ASC, r.id ASC`,
      [booking.id]
    ),
  ]);

  res.json({ booking, condition_logs: logs.rows, reviews: reviews.rows });
});

// PUT /api/bookings/:id - edit dates or message while REQUESTED (borrower)
const updateBooking = asyncHandler(async (req, res) => {
  const booking = await service.updateBooking(req.user, req.params.id, req.body);
  res.json({ booking });
});

// PATCH /api/bookings/:id/status - body: { action, note }
const changeStatus = asyncHandler(async (req, res) => {
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  res.json(await service.changeStatus(req.user, req.params.id, req.body.action, note));
});

// ---------------------------------------------------------------------
// DELETE /api/bookings/:id - remove a REJECTED or CANCELLED booking  (borrower / admin)
// ---------------------------------------------------------------------
const deleteBooking = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, borrower_id, status FROM bookings WHERE id = $1', [req.params.id]);
  const booking = rows[0];
  if (!booking) throw ApiError.notFound('Booking not found.');

  if (booking.borrower_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the borrower or an admin can delete this booking.');
  }

  // The status guard is repeated in the DELETE itself so it cannot race a status change.
  const { rowCount } = await query(
    `DELETE FROM bookings WHERE id = $1 AND status IN ('REJECTED', 'CANCELLED')`,
    [booking.id]
  );
  if (rowCount === 0) {
    throw ApiError.conflict('Only REJECTED or CANCELLED bookings can be deleted.');
  }
  res.status(204).send();
});

module.exports = {
  ACTION_NAMES,
  BOOKING_STATUSES,
  createBooking,
  listMyBorrowings,
  listIncomingRequests,
  getBooking,
  updateBooking,
  changeStatus,
  deleteBooking,
};
