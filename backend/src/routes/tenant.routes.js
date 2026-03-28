const router = require('express').Router();
const ctrl = require('../controllers/tenant.controller');
const { authenticate, isAdminOrManager } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createTenantValidation, updateTenantValidation } = require('../validators/tenant.validators');

router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/', authenticate, isAdminOrManager, createTenantValidation, validateRequest, ctrl.create);
router.put('/:id', authenticate, isAdminOrManager, updateTenantValidation, validateRequest, ctrl.update);
router.delete('/:id', authenticate, isAdminOrManager, ctrl.remove);

module.exports = router;
