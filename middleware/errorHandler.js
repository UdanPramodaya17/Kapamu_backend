const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(res, 422, 'Validation failed.', errors);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 409, `${field} already exists.`);
  }

  // Mongoose ObjectId Cast error
  if (err.name === 'CastError') {
    return sendError(res, 400, `Invalid ${err.path}: ${err.value}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') return sendError(res, 401, 'Invalid token.');
  if (err.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired.');

  // Default
  sendError(res, err.statusCode || 500, err.message || 'Internal server error.');
};

module.exports = errorHandler;
