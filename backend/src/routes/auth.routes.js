const router = require('express').Router();
const {
  registerOwner,
  registerOwnerFromInvite,
  getOwnerInviteDetails,
  getCsrfToken,
  login,
  forgotPassword,
  getResetPasswordDetails,
  resetPassword,
  logout,
  updateProfile,
  getMe,
  getInvitationDetails,
  setupAccount,
  changePassword,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  registerOwnerValidation,
  loginValidation,
  forgotPasswordValidation,
  invitationDetailsValidation,
  ownerRegistrationInviteValidation,
  registerOwnerFromInviteValidation,
  setupAccountValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
} = require('../validators/auth.validators');

router.get('/csrf-token', getCsrfToken);
router.post('/register', registerOwnerValidation, validateRequest, registerOwner);
router.get('/register/:token', ownerRegistrationInviteValidation, validateRequest, getOwnerInviteDetails);
router.post('/register/invite', registerOwnerFromInviteValidation, validateRequest, registerOwnerFromInvite);
router.post('/login', loginValidation, validateRequest, login);
router.post('/forgot-password', forgotPasswordValidation, validateRequest, forgotPassword);
router.get('/reset-password/:token', invitationDetailsValidation, validateRequest, getResetPasswordDetails);
router.post('/reset-password', resetPasswordValidation, validateRequest, resetPassword);
router.post('/logout', logout);
router.put('/profile', authenticate, updateProfileValidation, validateRequest, updateProfile);
router.get('/setup-account/:token', invitationDetailsValidation, validateRequest, getInvitationDetails);
router.post('/setup-account', setupAccountValidation, validateRequest, setupAccount);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePasswordValidation, validateRequest, changePassword);

module.exports = router;
