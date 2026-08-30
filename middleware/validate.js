const { sendError } = require('../utils/response');

/**
 * Zod validation middleware
 * @param {import('zod').Schema} schema
 * @param {'body'|'query'|'params'} target
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, 422, 'Validation failed.', errors);
    }
    req[target] = result.data;
    next();
  };
};

module.exports = { validate };
