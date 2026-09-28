const { withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { daysInclusive } = require('../utils/dates');

// Booking business rules and status changes live here, away from the HTTP layer.
// Controllers call these functions; every function that changes data runs inside
// one transaction and throws ApiError when a rule is broken.

const MAX_OPEN_BOOKINGS_PER_BORROWER = 3;

// ---------------------------------------------------------------------
// Section 06 - Booking workflow (status flow). This table IS the state
// machine: an action is only legal from the listed statuses, and only for
// the listed actor. Anything else is rejected (403 wrong actor, 409 wrong state).
//
//   action   who      from                 to          extra
//   approve  owner    REQUESTED            APPROVED    lock item, re-check overlap, auto-reject clashes
//   reject   owner    REQUESTED            REJECTED    optional reason saved
//   cancel   borrower REQUESTED, APPROVED  CANCELLED   dates become free again
//   pickup   owner    APPROVED             PICKED_UP   handover note -> condition_logs
//   return   owner    PICKED_UP            RETURNED    return note -> condition_logs, reviews open
// ---------------------------------------------------------------------
const ACTIONS = {
  approve: { from: ['REQUESTED'],             to: 'APPROVED',  actor: 'owner' },
  reject:  { from: ['REQUESTED'],             to: 'REJECTED',  actor: 'owner' },
  cancel:  { from: ['REQUESTED', 'APPROVED'], to: 'CANCELLED', actor: 'borrower' },
  pickup:  { from: ['APPROVED'],              to: 'PICKED_UP', actor: 'owner',    stage: 'handover' },
  return:  { from: ['PICKED_UP'],             to: 'RETURNED',  actor: 'owner',    stage: 'return' },
};
const ACTION_NAMES = Object.keys(ACTIONS);
const BOOKING_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PICKED_UP', 'RETURNED'];

// OVERDUE is not a status - it is computed: still PICKED_UP after end_date has passed.
const IS_OVERDUE = `(b.status = 'PICKED_UP' AND b.end_date < CURRENT_DATE)`;

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

/**
 * Load a booking for a state-changing operation and lock what must not change
 * underneath us. The ITEM row is locked first (this serialises every booking
 * decision on the same item, so two owners' requests can never both be approved
 * for overlapping dates), then the booking row. Lock order is always item -> booking.
 */
async function lockBooking(client, bookingId) {
  const pre = await client.query('SELECT item_id FROM bookings WHERE id = $1', [bookingId]);
  if (!pre.rows[0]) return null;

  await client.query('SELECT id FROM items WHERE id = $1 FOR UPDATE', [pre.rows[0].item_id]);

  const { rows } = await client.query(
    `SELECT b.*, i.owner_id, i.max_days, i.title AS item_title
     FROM bookings b JOIN items i ON i.id = b.item_id
     WHERE b.id = $1
     FOR UPDATE OF b`,
    [bookingId]
  );
  return rows[0] || null;
}

// The date-overlap query (heart of the project). A row returned = dates clash.
async function hasApprovedOverlap(client, itemId, start, end, excludeBookingId = null) {
  const { rows } = await client.query(
    `SELECT 1 FROM bookings
     WHERE item_id = $1
       AND status IN ('APPROVED', 'PICKED_UP')
       AND start_date <= $3      -- existing booking starts before the new one ends
       AND end_date   >= $2      -- and ends after the new one starts
       AND ($4::int IS NULL OR id <> $4)
     LIMIT 1`,
    [itemId, start, end, excludeBookingId]
  );
  return rows.length > 0;
}

// Date rules shared by "create" and "edit while REQUESTED".
async function assertDateRules(client, start, end, maxDays) {
  if (end < start) throw ApiError.badRequest('end_date must be on or after start_date.');

  const past = await client.query('SELECT $1::date < CURRENT_DATE AS past', [start]);
  if (past.rows[0].past) throw ApiError.badRequest('start_date must not be in the past.');

  if (daysInclusive(start, end) > maxDays) {
    throw ApiError.badRequest(`Booking duration exceeds this item's maximum of ${maxDays} days.`);
  }
}

function assertActor(booking, user, actor) {
  if (actor === 'owner' && booking.owner_id !== user.id) {
    throw ApiError.forbidden('Only the item owner can perform this action.');
  }
  if (actor === 'borrower' && booking.borrower_id !== user.id) {
    throw ApiError.forbidden('Only the borrower can perform this action.');
  }
}


// ---------------------------------------------------------------------
// POST /api/bookings - borrower sends a request
// All business rules are validated first, then a REQUESTED row is inserted.
// ---------------------------------------------------------------------
async function createBooking(borrowerId, { item_id, start_date, end_date, message }) {
  return withTransaction(async (client) => {
    // Serialise this borrower's requests so the "max 3 open" rule cannot be raced.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [borrowerId]);

    const itemRes = await client.query(
      `SELECT i.*, u.is_active AS owner_active
       FROM items i JOIN users u ON u.id = i.owner_id
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [item_id]
    );
    const item = itemRes.rows[0];
    if (!item) throw ApiError.notFound('Item not found.');

    if (!item.is_active || !item.owner_active) {
      throw ApiError.badRequest('This item is not currently available for borrowing.');
    }
    if (item.owner_id === borrowerId) {
      throw ApiError.badRequest('You cannot borrow your own item.');
    }

    await assertDateRules(client, start_date, end_date, item.max_days);

    if (await hasApprovedOverlap(client, item.id, start_date, end_date)) {
      throw ApiError.conflict('These dates overlap an existing approved booking for this item.');
    }

    const openCount = await client.query(
      `SELECT COUNT(*)::int AS n FROM bookings
       WHERE borrower_id = $1 AND status IN ('REQUESTED', 'APPROVED', 'PICKED_UP')`,
      [borrowerId]
    );
    if (openCount.rows[0].n >= MAX_OPEN_BOOKINGS_PER_BORROWER) {
      throw ApiError.conflict(
        `You already have ${MAX_OPEN_BOOKINGS_PER_BORROWER} open bookings. Resolve one before requesting another.`
      );
    }

    const inserted = await client.query(
      `INSERT INTO bookings (item_id, borrower_id, start_date, end_date, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [item.id, borrowerId, start_date, end_date, message || null]
    );
    return inserted.rows[0];
  });
}

// ---------------------------------------------------------------------
// PUT /api/bookings/:id - edit dates or message while REQUESTED (borrower)
// ---------------------------------------------------------------------
async function updateBooking(user, bookingId, { start_date, end_date, message }) {
  return withTransaction(async (client) => {
    const booking = await lockBooking(client, bookingId);
    if (!booking) throw ApiError.notFound('Booking not found.');
    assertActor(booking, user, 'borrower');

    if (booking.status !== 'REQUESTED') {
      throw ApiError.conflict('Only bookings still in REQUESTED status can be edited.');
    }

    const newStart = start_date || booking.start_date;
    const newEnd = end_date || booking.end_date;

    await assertDateRules(client, newStart, newEnd, booking.max_days);

    if (await hasApprovedOverlap(client, booking.item_id, newStart, newEnd, booking.id)) {
      throw ApiError.conflict('These dates overlap an existing approved booking for this item.');
    }

    const result = await client.query(
      `UPDATE bookings
       SET start_date = $1, end_date = $2, message = COALESCE($3, message), updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [newStart, newEnd, message === undefined ? null : message, booking.id]
    );
    return result.rows[0];
  });
}

// ---------------------------------------------------------------------
// PATCH /api/bookings/:id/status - one function drives the whole state machine
// (see ACTIONS above). note = optional reject reason for "reject", the condition
// note for "pickup" and "return".
// ---------------------------------------------------------------------
async function changeStatus(user, bookingId, action, note) {
  const rule = ACTIONS[action];
  return withTransaction(async (client) => {
    const booking = await lockBooking(client, bookingId);
    if (!booking) throw ApiError.notFound('Booking not found.');

    assertActor(booking, user, rule.actor);

    if (!rule.from.includes(booking.status)) {
      throw ApiError.conflict(`Cannot ${action} a booking that is ${booking.status}.`);
    }

    let autoRejected = [];

    if (action === 'approve') {
      // The item row is already locked, so this re-check cannot be invalidated
      // by a concurrent approval.
      if (await hasApprovedOverlap(client, booking.item_id, booking.start_date, booking.end_date, booking.id)) {
        throw ApiError.conflict('These dates now overlap another approved booking.');
      }
    }

    const updated = await client.query(
      `UPDATE bookings
       SET status = $2::varchar,
           reject_reason = CASE WHEN $2::varchar = 'REJECTED' THEN $3::text ELSE reject_reason END,
           updated_at = now()
       WHERE id = $1
       RETURNING *, (end_date < CURRENT_DATE) AS was_overdue`,
      [booking.id, rule.to, note || null]
    );

    if (action === 'approve') {
      // Auto-reject every other REQUESTED booking that clashes, in the same transaction.
      const clashes = await client.query(
        `UPDATE bookings
         SET status = 'REJECTED',
             reject_reason = 'Automatically rejected: these dates were approved for another borrower.',
             updated_at = now()
         WHERE item_id = $1 AND id <> $2 AND status = 'REQUESTED'
           AND start_date <= $4 AND end_date >= $3
         RETURNING id`,
        [booking.item_id, booking.id, booking.start_date, booking.end_date]
      );
      autoRejected = clashes.rows.map((r) => r.id);
    }

    if (rule.stage) {
      await client.query(
        `INSERT INTO condition_logs (booking_id, stage, note, logged_by)
         VALUES ($1, $2, $3, $4)`,
        [booking.id, rule.stage, note, user.id]
      );
    }

    return { booking: updated.rows[0], auto_rejected: autoRejected };
  });
}

module.exports = {
  MAX_OPEN_BOOKINGS_PER_BORROWER,
  ACTIONS,
  ACTION_NAMES,
  BOOKING_STATUSES,
  IS_OVERDUE,
  createBooking,
  updateBooking,
  changeStatus,
};
