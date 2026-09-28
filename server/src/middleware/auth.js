const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { query } = require('../config/db');
const env = require('../config/env');

/**
 * requireAuth: verifies the Bearer JWT, loads the current user from DB
 * (so deactivated/deleted users are rejected even with a valid token),
 * and attaches it to req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Missing or malformed Authorization header.');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (e) {
      throw ApiError.unauthorized('Invalid or expired token.');
    }

    const { rows } = await query(
      'SELECT id, name, email, phone, area, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];

    if (!user) throw ApiError.unauthorized('User no longer exists.');
    if (!user.is_active) throw ApiError.forbidden('Account has been deactivated.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
