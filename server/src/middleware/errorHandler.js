const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// 404 for unmatched routes
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Maps known Postgres error codes to clean HTTP responses.
function mapPgError(err) {
  switch (err.code) {
    case '23505': // unique_violation
      return ApiError.conflict('A record with these values already exists.');
    case '23503': // foreign_key_violation
      return ApiError.badRequest('Referenced record does not exist, or is still referenced by other records.');
    case '23514': // check_violation
      return ApiError.badRequest('Value violates a database constraint.');
    case '22P02': // invalid_text_representation (e.g. "abc" for an integer)
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return ApiError.badRequest('Invalid value in request.');
    default:
      return null;
  }
}

// Final error handler - must be registered last, after all routes.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Request body is not valid JSON.');
  } else if (err.code && typeof err.code === 'string') {
    const mapped = mapPgError(err);
    if (mapped) error = mapped;
  }

  if (!(error instanceof ApiError)) {
    console.error('Unhandled error:', err);
    error = new ApiError(500, 'Internal server error');
  }

  const body = { error: error.message };
  if (error.details) body.details = error.details;
  if (env.NODE_ENV !== 'production' && error.statusCode === 500) {
    body.stack = err.stack;
  }

  res.status(error.statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
