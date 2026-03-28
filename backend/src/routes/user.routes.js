const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { inviteUserValidation, updateUserValidation } = require('../validators/user.validators');

router.get('/', authenticate, isAdmin, ctrl.getAll);
router.post('/', authenticate, isAdmin, inviteUserValidation, validateRequest, ctrl.create);
router.post('/invite', authenticate, isAdmin, inviteUserValidation, validateRequest, ctrl.create);
router.put('/:id', authenticate, isAdmin, updateUserValidation, validateRequest, ctrl.update);
router.get('/roles', authenticate, ctrl.getRoles);

module.exports = router;
