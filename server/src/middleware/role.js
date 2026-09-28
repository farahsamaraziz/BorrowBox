const ApiError = require('../utils/ApiError');

/**
 * requireRole('admin'): must come after requireAuth.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }
    next();
  };
}

module.exports = { requireRole };
