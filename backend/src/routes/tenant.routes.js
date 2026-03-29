const router = require('express').Router();
const ctrl = require('../controllers/tenant.controller');
const { authenticate, isAdminOrManager } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createTenantValidation, updateTenantValidation, extendLeaseValidation } = require('../validators/tenant.validators');

router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.put('/:id/extend-lease', authenticate, isAdminOrManager, extendLeaseValidation, validateRequest, ctrl.extendLease);
router.post('/', authenticate, isAdminOrManager, createTenantValidation, validateRequest, ctrl.create);
router.put('/:id', authenticate, isAdminOrManager, updateTenantValidation, validateRequest, ctrl.update);
router.delete('/:id', authenticate, isAdminOrManager, ctrl.remove);

module.exports = router;
