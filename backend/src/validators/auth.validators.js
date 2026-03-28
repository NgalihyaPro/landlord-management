const { body, param } = require('express-validator');

const emailField = (fieldName = 'email') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail();

const passwordField = (fieldName = 'password') =>
  body(fieldName)
    .isString()
    .withMessage('Password is required.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.');

const registerOwnerValidation = [
  body('full_name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  emailField(),
  passwordField(),
  body('business_name').trim().notEmpty().withMessage('Business name is required.').isLength({ max: 160 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('business_phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('business_address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

const loginValidation = [
  emailField(),
  body('password').isString().withMessage('Password is required.').notEmpty().withMessage('Password is required.'),
];

const forgotPasswordValidation = [
  emailField(),
];

const invitationDetailsValidation = [
  param('token')
    .trim()
    .isLength({ min: 32, max: 256 })
    .withMessage('Invitation token is invalid.'),
];

const ownerRegistrationInviteValidation = invitationDetailsValidation;

const registerOwnerFromInviteValidation = [
  body('token')
    .trim()
    .isLength({ min: 32, max: 256 })
    .withMessage('Registration invite token is invalid.'),
  body('full_name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  passwordField(),
  body('business_name').trim().notEmpty().withMessage('Business name is required.').isLength({ max: 160 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('business_phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('business_address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

const setupAccountValidation = [
  body('token')
    .trim()
    .isLength({ min: 32, max: 256 })
    .withMessage('Invitation token is invalid.'),
  body('full_name').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 120 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  passwordField(),
];

const resetPasswordValidation = [
  body('token')
    .trim()
    .isLength({ min: 32, max: 256 })
    .withMessage('Password reset token is invalid.'),
  passwordField(),
];

const changePasswordValidation = [
  body('current_password')
    .isString()
    .withMessage('Current password is required.')
    .notEmpty()
    .withMessage('Current password is required.'),
  body('new_password')
    .isString()
    .withMessage('New password is required.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long.')
    .custom((value, { req }) => value !== req.body.current_password)
    .withMessage('New password must be different from the current password.'),
];

const updateProfileValidation = [
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ max: 120 })
    .withMessage('Full name is too long.'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 40 })
    .withMessage('Phone number is too long.'),
];

module.exports = {
  registerOwnerValidation,
  loginValidation,
  forgotPasswordValidation,
  invitationDetailsValidation,
  ownerRegistrationInviteValidation,
  registerOwnerFromInviteValidation,
  setupAccountValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
};
