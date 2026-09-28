const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const SORT_OPTIONS = {
  newest: 'i.created_at DESC, i.id DESC',
  oldest: 'i.created_at ASC, i.id ASC',
  title_asc: 'i.title ASC',
  title_desc: 'i.title DESC',
};

// Escape LIKE wildcards so a search for "50%" matches literally.
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

// GET /api/items?search=&category=&condition=&from=&to=&page=   (public)
// category: one id/name or several, comma separated (?category=1,3).
// condition: new | good | fair.
// Optional extras: sort (newest|oldest|title_asc|title_desc), limit.
//
// from + to: only items with NO APPROVED / PICKED_UP booking overlapping those
// dates are returned (a NOT EXISTS sub-query).
const listItems = asyncHandler(async (req, res) => {
  const { search, category, condition, from, to, sort = 'newest', page = 1, limit = 12 } = req.query;

  if ((from && !to) || (!from && to)) {
    throw ApiError.badRequest('Provide both "from" and "to" to filter by availability.');
  }
  if (from && to && to < from) {
    throw ApiError.badRequest('"to" must be on or after "from".');
  }

  const conditions = ['i.is_active = true', 'u.is_active = true'];
  const params = [];

  if (search) {
    params.push(`%${escapeLike(String(search))}%`);
    conditions.push(`(i.title ILIKE $${params.length} OR i.description ILIKE $${params.length})`);
  }

  if (category) {
    // ids (?category=1,3) and/or names (?category=Power Tools) - any match qualifies
    const parts = String(category).split(',').map((v) => v.trim()).filter(Boolean);
    const ids = parts.filter((v) => /^\d+$/.test(v)).map(Number);
    const names = parts.filter((v) => !/^\d+$/.test(v));
    const ors = [];
    if (ids.length) {
      params.push(ids);
      ors.push(`i.category_id = ANY($${params.length}::int[])`);
    }
    if (names.length) {
      params.push(names.map(escapeLike));
      ors.push(`c.name ILIKE ANY($${params.length}::text[])`);
    }
    if (ors.length) conditions.push(`(${ors.join(' OR ')})`);
  }

  if (condition) {
    params.push(String(condition));
    conditions.push(`i.condition = $${params.length}`);
  }

  if (from && to) {
    params.push(from, to);
    const fromIdx = params.length - 1;
    const toIdx = params.length;
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.item_id = i.id
        AND b.status IN ('APPROVED', 'PICKED_UP')
        AND b.start_date <= $${toIdx}
        AND b.end_date   >= $${fromIdx}
    )`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const offset = (pageNum - 1) * limitNum;

  const fromClause = `FROM items i
     JOIN categories c ON c.id = i.category_id
     JOIN users u ON u.id = i.owner_id`;

  const countResult = await query(`SELECT COUNT(*)::int AS n ${fromClause} ${where}`, params);
  const total = countResult.rows[0].n;

  params.push(limitNum, offset);
  const { rows } = await query(
    `SELECT i.*, c.name AS category_name, u.name AS owner_name,
            (SELECT ROUND(AVG(r.rating)::numeric, 2)::float8 FROM reviews r WHERE r.reviewee_id = i.owner_id) AS owner_rating,
            (SELECT COUNT(*)::int FROM reviews r WHERE r.reviewee_id = i.owner_id) AS owner_review_count,
            NOT EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.item_id = i.id AND b.status IN ('APPROVED', 'PICKED_UP')
                AND b.start_date <= CURRENT_DATE AND b.end_date >= CURRENT_DATE
            ) AS available_now
     ${fromClause}
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    items: rows,
    pagination: { page: pageNum, limit: limitNum, total, total_pages: Math.ceil(total / limitNum) },
  });
});

// GET /api/items/mine - items I listed, active or not   (member)
const listMyItems = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, c.name AS category_name
     FROM items i JOIN categories c ON c.id = i.category_id
     WHERE i.owner_id = $1
     ORDER BY i.created_at DESC, i.id DESC`,
    [req.user.id]
  );
  res.json({ items: rows });
});

// GET /api/items/:id - item details with owner info and rating   (public)
const getItem = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, c.name AS category_name,
            u.name AS owner_name, u.area AS owner_area,
            (SELECT ROUND(AVG(r.rating)::numeric, 2)::float8 FROM reviews r WHERE r.reviewee_id = i.owner_id) AS owner_rating,
            (SELECT COUNT(*)::int FROM reviews r WHERE r.reviewee_id = i.owner_id) AS owner_review_count
     FROM items i
     JOIN categories c ON c.id = i.category_id
     JOIN users u ON u.id = i.owner_id
     WHERE i.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw ApiError.notFound('Item not found.');
  res.json({ item: rows[0] });
});

// GET /api/items/:id/availability - date ranges that are already booked   (public)
// Only APPROVED / PICKED_UP bookings block dates. Past ranges are left out.
const getAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await query('SELECT id, max_days FROM items WHERE id = $1', [id]);
  if (!item.rows[0]) throw ApiError.notFound('Item not found.');

  const { rows } = await query(
    `SELECT start_date, end_date
     FROM bookings
     WHERE item_id = $1
       AND status IN ('APPROVED', 'PICKED_UP')
       AND end_date >= CURRENT_DATE
     ORDER BY start_date ASC`,
    [id]
  );
  res.json({ item_id: item.rows[0].id, max_days: item.rows[0].max_days, booked: rows });
});

// POST /api/items - create; owner_id comes from the token   (member)
const createItem = asyncHandler(async (req, res) => {
  const { title, description, category_id, condition = 'good', max_days, pickup_area, image_url } = req.body;

  const cat = await query('SELECT id FROM categories WHERE id = $1', [category_id]);
  if (!cat.rows[0]) throw ApiError.badRequest('Invalid category_id.');

  const { rows } = await query(
    `INSERT INTO items (owner_id, category_id, title, description, condition, max_days, pickup_area, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [req.user.id, category_id, title, description || null, condition, max_days, pickup_area || null, image_url || null]
  );

  res.status(201).json({ item: rows[0] });
});

// Fetch an item and check the caller may act on it.
async function loadItemFor(itemId, user, { allowAdmin }) {
  const { rows } = await query('SELECT * FROM items WHERE id = $1', [itemId]);
  const item = rows[0];
  if (!item) throw ApiError.notFound('Item not found.');
  const isOwner = item.owner_id === user.id;
  if (!isOwner && !(allowAdmin && user.role === 'admin')) {
    throw ApiError.forbidden('You do not own this item.');
  }
  return item;
}

// PUT /api/items/:id - edit details or (de)activate   (owner)
// Fields left out of the body keep their current value.
const updateItem = asyncHandler(async (req, res) => {
  const item = await loadItemFor(req.params.id, req.user, { allowAdmin: false });
  const { title, description, category_id, condition, max_days, pickup_area, image_url, is_active } = req.body;

  if (category_id !== undefined) {
    const cat = await query('SELECT id FROM categories WHERE id = $1', [category_id]);
    if (!cat.rows[0]) throw ApiError.badRequest('Invalid category_id.');
  }

  const { rows } = await query(
    `UPDATE items SET
       title       = COALESCE($1, title),
       description = COALESCE($2, description),
       category_id = COALESCE($3, category_id),
       condition   = COALESCE($4, condition),
       max_days    = COALESCE($5, max_days),
       pickup_area = COALESCE($6, pickup_area),
       image_url   = COALESCE($7, image_url),
       is_active   = COALESCE($8, is_active)
     WHERE id = $9
     RETURNING *`,
    [title, description, category_id, condition, max_days, pickup_area, image_url, is_active, item.id]
  );

  res.json({ item: rows[0] });
});

// DELETE /api/items/:id   (owner or admin)
// Hard delete only if the item never had a booking; otherwise deactivate so
// booking history and reviews stay intact.
const deleteItem = asyncHandler(async (req, res) => {
  const item = await loadItemFor(req.params.id, req.user, { allowAdmin: true });

  const history = await query('SELECT 1 FROM bookings WHERE item_id = $1 LIMIT 1', [item.id]);

  if (history.rows.length > 0) {
    const { rows } = await query(
      'UPDATE items SET is_active = false WHERE id = $1 RETURNING *',
      [item.id]
    );
    return res.json({ deactivated: true, item: rows[0] });
  }

  await query('DELETE FROM items WHERE id = $1', [item.id]);
  res.status(204).send();
});

module.exports = { listItems, listMyItems, getItem, getAvailability, createItem, updateItem, deleteItem };
