const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/', authenticate, ctrl.getAll);
router.put('/:id/read', authenticate, ctrl.markRead);

module.exports = router;
