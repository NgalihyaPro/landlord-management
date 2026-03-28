const { body, param } = require('express-validator');

const createUnitValidation = [
  body('property_id').isInt({ min: 1 }).withMessage('Property is required.').toInt(),
  body('unit_number').trim().notEmpty().withMessage('Unit number is required.').isLength({ max: 40 }),
  body('floor_number').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Floor number is invalid.').toInt(),
  body('unit_type').optional({ values: 'falsy' }).trim().isLength({ max: 50 }),
  body('monthly_rent').isFloat({ min: 0 }).withMessage('Monthly rent must be 0 or more.').toFloat(),
  body('deposit_amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Deposit amount must be 0 or more.').toFloat(),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

const updateUnitValidation = [
  param('id').isInt({ min: 1 }).withMessage('Unit id is invalid.').toInt(),
  body('unit_number').trim().notEmpty().withMessage('Unit number is required.').isLength({ max: 40 }),
  body('floor_number').isInt({ min: 0 }).withMessage('Floor number is invalid.').toInt(),
  body('unit_type').trim().notEmpty().withMessage('Unit type is required.').isLength({ max: 50 }),
  body('monthly_rent').isFloat({ min: 0 }).withMessage('Monthly rent must be 0 or more.').toFloat(),
  body('deposit_amount').isFloat({ min: 0 }).withMessage('Deposit amount must be 0 or more.').toFloat(),
  body('status').isIn(['vacant', 'occupied', 'maintenance']).withMessage('Unit status is invalid.'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

module.exports = {
  createUnitValidation,
  updateUnitValidation,
};
