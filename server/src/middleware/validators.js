const { param, body, query } = require('express-validator');

// Reusable validation chains (run `validate` after them).

const idParam = (name = 'id') =>
  param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer.`).toInt();

const DATE_OPTS = { format: 'YYYY-MM-DD', strictMode: true, delimiters: ['-'] };

const dateBody = (field, { optional = false } = {}) => {
  const chain = body(field);
  return (optional ? chain.optional() : chain)
    .isDate(DATE_OPTS)
    .withMessage(`${field} must be a valid date (YYYY-MM-DD).`);
};

const dateQuery = (field) =>
  query(field).optional({ checkFalsy: true }).isDate(DATE_OPTS)
    .withMessage(`${field} must be a valid date (YYYY-MM-DD).`);

module.exports = { idParam, dateBody, dateQuery };
