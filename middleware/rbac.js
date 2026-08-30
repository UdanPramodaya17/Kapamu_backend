const { sendError } = require('../utils/response');

/**
 * Role-Based Access Control middleware
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 401, 'Not authenticated.');
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, `Role '${req.user.role}' is not authorized for this resource.`);
    }
    next();
  };
};

module.exports = { authorize };
