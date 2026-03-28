const { body } = require('express-validator');

const createPaymentValidation = [
  body('tenant_id').isInt({ min: 1 }).withMessage('Tenant is required.').toInt(),
  body('payment_method_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Payment method is invalid.').toInt(),
  body('amount_paid').isFloat({ min: 0.01 }).withMessage('Amount paid must be greater than 0.').toFloat(),
  body('payment_date').isISO8601().withMessage('Payment date is invalid.'),
  body('reference_number').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

module.exports = {
  createPaymentValidation,
};
