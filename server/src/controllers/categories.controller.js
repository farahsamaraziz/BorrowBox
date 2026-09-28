const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/categories - list all (public), with a live count of active items
const listCategories = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name,
            (SELECT COUNT(*)::int FROM items i WHERE i.category_id = c.id AND i.is_active = true) AS item_count
     FROM categories c
     ORDER BY c.name ASC`
  );
  res.json({ categories: rows });
});

// POST /api/categories (admin)
const createCategory = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
    [req.body.name.trim()]
  );
  res.status(201).json({ category: rows[0] });
});

// PUT /api/categories/:id (admin) - rename
const updateCategory = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name',
    [req.body.name.trim(), req.params.id]
  );
  if (!rows[0]) throw ApiError.notFound('Category not found.');
  res.json({ category: rows[0] });
});

// DELETE /api/categories/:id (admin) - 409 if any item uses it
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inUse = await query('SELECT 1 FROM items WHERE category_id = $1 LIMIT 1', [id]);
  if (inUse.rows.length > 0) {
    throw ApiError.conflict('This category is in use by one or more items and cannot be deleted.');
  }

  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [id]);
  if (rowCount === 0) throw ApiError.notFound('Category not found.');
  res.status(204).send();
});

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
