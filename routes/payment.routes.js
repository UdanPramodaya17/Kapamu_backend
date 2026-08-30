const express = require('express');
const router = express.Router();
const { initiatePayment, handleNotify, verifyPayment } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');

// Initiate a PayHere payment (authenticated customer)
router.post('/initiate', protect, initiatePayment);

// PayHere server-to-server notify — NO auth (PayHere calls this directly)
router.post('/notify', handleNotify);

// Verify payment status after returning from PayHere
router.get('/verify/:payhereOrderId', protect, verifyPayment);

module.exports = router;
