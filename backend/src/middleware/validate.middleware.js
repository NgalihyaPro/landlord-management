const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  return res.status(422).json({
    error: 'Validation failed.',
    details: result.array({ onlyFirstError: true }).map((issue) => ({
      field: issue.path,
      message: issue.msg,
    })),
  });
};

module.exports = { validateRequest };
