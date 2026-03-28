const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

router.get('/', authenticate, ctrl.getAll);
router.put('/', authenticate, isAdmin, ctrl.update);

module.exports = router;
