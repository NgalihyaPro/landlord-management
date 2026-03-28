const router = require('express').Router();
const ctrl = require('../controllers/unit.controller');
const { authenticate, isAdminOrManager } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createUnitValidation, updateUnitValidation } = require('../validators/unit.validators');

router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/', authenticate, isAdminOrManager, createUnitValidation, validateRequest, ctrl.create);
router.put('/:id', authenticate, isAdminOrManager, updateUnitValidation, validateRequest, ctrl.update);
router.delete('/:id', authenticate, isAdminOrManager, ctrl.remove);

module.exports = router;
