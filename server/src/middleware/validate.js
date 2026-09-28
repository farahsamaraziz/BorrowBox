const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Run after an array of express-validator checks; turns validation
// failures into a clean 400 ApiError instead of leaking raw arrays.
function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(ApiError.badRequest('Validation failed.', details));
  }
  next();
}

module.exports = validate;
