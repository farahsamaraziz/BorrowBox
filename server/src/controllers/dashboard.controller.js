const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/dashboard/summary - badge counts for My Items / My Borrowings / Incoming Requests
const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [myItems, myBorrowings, incoming] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM items WHERE owner_id = $1 AND is_active = true', [userId]),
    query(
      `SELECT COUNT(*)::int AS n FROM bookings WHERE borrower_id = $1 AND status IN ('REQUESTED','APPROVED','PICKED_UP')`,
      [userId]
    ),
    query(
      `SELECT COUNT(*)::int AS n FROM bookings b JOIN items i ON i.id = b.item_id
       WHERE i.owner_id = $1 AND b.status = 'REQUESTED'`,
      [userId]
    ),
  ]);

  res.json({
    active_items: myItems.rows[0].n,
    open_borrowings: myBorrowings.rows[0].n,
    pending_incoming_requests: incoming.rows[0].n,
  });
});

module.exports = { getSummary };
