const { body, param } = require('express-validator');

const createTenantValidation = [
  body('unit_id').isInt({ min: 1 }).withMessage('Unit is required.').toInt(),
  body('property_id').isInt({ min: 1 }).withMessage('Property is required.').toInt(),
  body('full_name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  body('phone').trim().notEmpty().withMessage('Phone number is required.').isLength({ max: 40 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('national_id').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
  body('emergency_contact_name').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('emergency_contact_phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('lease_start').isISO8601().withMessage('Lease start date is invalid.').toDate(),
  body('lease_end').optional({ values: 'falsy' }).isISO8601().withMessage('Lease end date is invalid.'),
  body('next_due_date').isISO8601().withMessage('Next due date is invalid.'),
  body('monthly_rent').isFloat({ min: 0 }).withMessage('Monthly rent must be 0 or more.').toFloat(),
  body('months_rented').isInt({ min: 1 }).withMessage('Months rented must be at least 1.').toInt(),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
];

const updateTenantValidation = [
  param('id').isInt({ min: 1 }).withMessage('Tenant id is invalid.').toInt(),
  body('full_name').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 120 }),
  body('phone').trim().notEmpty().withMessage('Phone number is required.').isLength({ max: 40 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('national_id').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
  body('emergency_contact_name').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('emergency_contact_phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('lease_end').optional({ values: 'falsy' }).isISO8601().withMessage('Lease end date is invalid.'),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  body('monthly_rent').isFloat({ min: 0 }).withMessage('Monthly rent must be 0 or more.').toFloat(),
];

const extendLeaseValidation = [
  param('id').isInt({ min: 1 }).withMessage('Tenant id is invalid.').toInt(),
  body('lease_end').isISO8601().withMessage('New lease end date is invalid.'),
];

module.exports = {
  createTenantValidation,
  updateTenantValidation,
  extendLeaseValidation,
};
