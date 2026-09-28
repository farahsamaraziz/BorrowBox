// Wraps an async route handler so rejected promises are forwarded to next()
// instead of crashing the process or requiring try/catch in every controller.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
