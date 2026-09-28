const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function sanitizeUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

// POST /api/auth/register - create account, hash password, return user + JWT
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, area } = req.body;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, phone, area)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, phone, area, role, is_active, created_at`,
    [name, email, password_hash, phone || null, area || null]
  );

  const user = rows[0];
  res.status(201).json({ user, token: signToken(user) });
});

// POST /api/auth/login - verify credentials, return user + JWT
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];

  if (!user) throw ApiError.unauthorized('Invalid email or password.');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw ApiError.unauthorized('Invalid email or password.');

  if (!user.is_active) throw ApiError.forbidden('Account has been deactivated.');

  res.json({ user: sanitizeUser(user), token: signToken(user) });
});

// GET /api/auth/me - the logged-in user's profile
const getMe = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, phone, area, role, is_active, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json({ user: rows[0] });
});

module.exports = { register, login, getMe };
