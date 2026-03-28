const { body, param } = require('express-validator');

const createPropertyValidation = [
  body('name').trim().notEmpty().withMessage('Property name is required.').isLength({ max: 160 }),
  body('address').trim().notEmpty().withMessage('Address is required.').isLength({ max: 255 }),
  body('city').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('region').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('country').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  body('total_units').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Total units must be 0 or more.').toInt(),
];

const updatePropertyValidation = [
  param('id').isInt({ min: 1 }).withMessage('Property id is invalid.').toInt(),
  ...createPropertyValidation,
  body('status')
    .optional({ values: 'falsy' })
    .isIn(['active', 'inactive'])
    .withMessage('Property status is invalid.'),
];

module.exports = {
  createPropertyValidation,
  updatePropertyValidation,
};
