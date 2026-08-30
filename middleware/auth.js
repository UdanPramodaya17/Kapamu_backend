const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user) return sendError(res, 401, 'User not found.');
    if (!user.isActive) return sendError(res, 403, 'Account is deactivated.');

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return sendError(res, 401, 'Invalid token.');
    if (error.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired.');
    next(error);
  }
};

module.exports = { protect };
