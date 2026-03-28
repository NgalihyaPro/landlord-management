const router = require('express').Router();
const ctrl = require('../controllers/property.controller');
const { authenticate, isAdminOrManager } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createPropertyValidation, updatePropertyValidation } = require('../validators/property.validators');

router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/', authenticate, isAdminOrManager, createPropertyValidation, validateRequest, ctrl.create);
router.put('/:id', authenticate, isAdminOrManager, updatePropertyValidation, validateRequest, ctrl.update);
router.delete('/:id', authenticate, isAdminOrManager, ctrl.remove);

module.exports = router;
