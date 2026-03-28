const router = require('express').Router();
const ctrl = require('../controllers/platform-admin.controller');
const { authenticate, isPlatformAdmin } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  registrationStatusQueryValidation,
  registrationDecisionValidation,
  registrationActionValidation,
  registrationDeleteValidation,
  createOwnerInviteValidation,
} = require('../validators/platform-admin.validators');

router.post(
  '/owner-invites',
  authenticate,
  isPlatformAdmin,
  createOwnerInviteValidation,
  validateRequest,
  ctrl.createOwnerInvite
);
router.get(
  '/registrations',
  authenticate,
  isPlatformAdmin,
  registrationStatusQueryValidation,
  validateRequest,
  ctrl.getRegistrations
);
router.put(
  '/registrations/:id/approve',
  authenticate,
  isPlatformAdmin,
  registrationDecisionValidation,
  validateRequest,
  ctrl.approveRegistration
);
router.put(
  '/registrations/:id/reject',
  authenticate,
  isPlatformAdmin,
  registrationDecisionValidation,
  validateRequest,
  ctrl.rejectRegistration
);
router.put(
  '/registrations/:id/restrict',
  authenticate,
  isPlatformAdmin,
  registrationActionValidation,
  validateRequest,
  ctrl.restrictRegistration
);
router.put(
  '/registrations/:id/restore',
  authenticate,
  isPlatformAdmin,
  registrationActionValidation,
  validateRequest,
  ctrl.restoreRegistration
);
router.delete(
  '/registrations/:id',
  authenticate,
  isPlatformAdmin,
  registrationDeleteValidation,
  validateRequest,
  ctrl.deleteRegistration
);

module.exports = router;
