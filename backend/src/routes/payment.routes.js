const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const { authenticate, isAdminOrManager } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createPaymentValidation } = require('../validators/payment.validators');

router.get('/', authenticate, ctrl.getAll);
router.post('/', authenticate, isAdminOrManager, createPaymentValidation, validateRequest, ctrl.create);
router.get('/methods', authenticate, ctrl.getPaymentMethods);
router.get('/:id/receipt', authenticate, ctrl.getReceipt);
router.delete('/:id', authenticate, isAdminOrManager, ctrl.remove);

module.exports = router;
