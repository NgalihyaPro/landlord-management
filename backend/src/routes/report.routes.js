const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/overview', authenticate, ctrl.getOverview);
router.get('/payments', authenticate, ctrl.getPaymentHistory);

module.exports = router;
