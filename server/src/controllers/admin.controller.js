const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/admin/users - list all users (optional ?status=active|inactive, page, limit)
const listUsers = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const conditions = [];
  const params = [];

  if (status === 'active') conditions.push('is_active = true');
  if (status === 'inactive') conditions.push('is_active = false');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const countRes = await query(`SELECT COUNT(*)::int AS n FROM users ${where}`, params);
  params.push(limitNum, offset);

  const { rows } = await query(
    `SELECT id, name, email, phone, area, role, is_active, created_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    users: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countRes.rows[0].n,
      total_pages: Math.ceil(countRes.rows[0].n / limitNum),
    },
  });
});

// PATCH /api/admin/users/:id/status - activate or deactivate a user
// (extra, beyond the required spec: gives admins a way to moderate accounts)
const setUserStatus = asyncHandler(async (req, res) => {
  const { is_active } = req.body;
  const { id } = req.params;

  if (Number(id) === req.user.id) {
    throw ApiError.badRequest('You cannot change your own active status.');
  }

  const { rows } = await query(
    `UPDATE users SET is_active = $1
     WHERE id = $2
     RETURNING id, name, email, role, is_active`,
    [is_active, id]
  );
  if (!rows[0]) throw ApiError.notFound('User not found.');

  res.json({ user: rows[0] });
});

// GET /api/admin/stats - totals of users, items and bookings by status
const getStats = asyncHandler(async (req, res) => {
  const [users, activeItems, totalItems, bookingsByStatus] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM users'),
    query('SELECT COUNT(*)::int AS n FROM items WHERE is_active = true'),
    query('SELECT COUNT(*)::int AS n FROM items'),
    query('SELECT status, COUNT(*)::int AS n FROM bookings GROUP BY status'),
  ]);

  const bookingCounts = { REQUESTED: 0, APPROVED: 0, PICKED_UP: 0, RETURNED: 0, REJECTED: 0, CANCELLED: 0 };
  bookingsByStatus.rows.forEach((r) => { bookingCounts[r.status] = r.n; });

  res.json({
    total_users: users.rows[0].n,
    active_items: activeItems.rows[0].n,
    total_items: totalItems.rows[0].n,
    total_bookings: Object.values(bookingCounts).reduce((a, b) => a + b, 0),
    bookings_by_status: bookingCounts,
  });
});

module.exports = { listUsers, setUserStatus, getStats };
