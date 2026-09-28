const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getTrustStats } = require('../utils/trust');

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const blankToNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

// PUT /api/users/me - update name, phone, area.
// Fields left out of the body are unchanged; phone/area sent as '' are cleared.
const updateMe = asyncHandler(async (req, res) => {
  const current = req.user;

  const name = has(req.body, 'name') ? req.body.name.trim() : current.name;
  const phone = has(req.body, 'phone') ? blankToNull(req.body.phone) : current.phone;
  const area = has(req.body, 'area') ? blankToNull(req.body.area) : current.area;

  const { rows } = await query(
    `UPDATE users SET name = $1, phone = $2, area = $3
     WHERE id = $4
     RETURNING id, name, email, phone, area, role, is_active, created_at`,
    [name, phone, area, current.id]
  );
  res.json({ user: rows[0] });
});

// DELETE /api/users/me - soft delete (is_active = false).
// Blocked while the user still has open bookings, as borrower or as item owner.
const deleteMe = asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    throw ApiError.forbidden('Admin accounts cannot delete themselves.');
  }

  const open = await query(
    `SELECT COUNT(*)::int AS n
     FROM bookings b JOIN items i ON i.id = b.item_id
     WHERE (b.borrower_id = $1 OR i.owner_id = $1)
       AND b.status IN ('REQUESTED', 'APPROVED', 'PICKED_UP')`,
    [req.user.id]
  );
  if (open.rows[0].n > 0) {
    throw ApiError.conflict(
      `You still have ${open.rows[0].n} open booking(s). Finish, cancel or reject them before deleting your account.`
    );
  }

  await query('UPDATE users SET is_active = false WHERE id = $1', [req.user.id]);
  res.status(204).send();
});

// GET /api/users/:id - public profile with trust score and reviews received
const getPublicProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await query(
    'SELECT id, name, area, created_at FROM users WHERE id = $1 AND is_active = true',
    [id]
  );
  const user = rows[0];
  if (!user) throw ApiError.notFound('User not found.');

  const trust = await getTrustStats(id);

  const reviews = await query(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            r.reviewer_id, u.name AS reviewer_name
     FROM reviews r JOIN users u ON u.id = r.reviewer_id
     WHERE r.reviewee_id = $1
     ORDER BY r.created_at DESC
     LIMIT 50`,
    [id]
  );

  res.json({ user, ...trust, reviews: reviews.rows });
});

module.exports = { updateMe, deleteMe, getPublicProfile };
