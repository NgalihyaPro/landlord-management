const { body, param } = require('express-validator');

const inviteUserValidation = [
  body('full_name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('role_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Role is invalid.')
    .toInt(),
];

const updateUserValidation = [
  param('id').isInt({ min: 1 }).withMessage('User id is invalid.').toInt(),
  body('full_name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('role_id').isInt({ min: 1 }).withMessage('Role is invalid.').toInt(),
  body('is_active').isBoolean().withMessage('Active status must be true or false.').toBoolean(),
];

module.exports = {
  inviteUserValidation,
  updateUserValidation,
};
