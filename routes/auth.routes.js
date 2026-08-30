const express = require('express');
const router = express.Router();
const { register, login, refresh, logout, getMe, googleAuth, sendVerificationCode, verifyCode, sendSetupPassword, setNewPassword, updateProfile, updatePassword, forgotPassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, refreshSchema } = require('../schemas/auth.schema');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.post('/google', googleAuth);

router.post('/send-verification', sendVerificationCode);
router.post('/verify-code', verifyCode);

router.post('/send-setup-password', sendSetupPassword);
router.post('/set-new-password', setNewPassword);

router.post('/forgot-password', forgotPassword);

module.exports = router;
