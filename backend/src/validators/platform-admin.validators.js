const { body, param, query } = require('express-validator');

const registrationStatusQueryValidation = [
  query('status')
    .optional({ values: 'falsy' })
    .isIn(['pending', 'approved', 'rejected', 'all'])
    .withMessage('Status filter is invalid.'),
];

const registrationDecisionValidation = [
  param('id').isInt({ min: 1 }).withMessage('Registration id is invalid.').toInt(),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
];

const registrationActionValidation = [
  param('id').isInt({ min: 1 }).withMessage('Registration id is invalid.').toInt(),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
];

const registrationDeleteValidation = [
  param('id').isInt({ min: 1 }).withMessage('Registration id is invalid.').toInt(),
];

const createOwnerInviteValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  body('full_name').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
];

module.exports = {
  registrationStatusQueryValidation,
  registrationDecisionValidation,
  registrationActionValidation,
  registrationDeleteValidation,
  createOwnerInviteValidation,
};
