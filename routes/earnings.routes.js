const express = require('express');
const router = express.Router();
const {
  getCommissionRate,
  updateCommissionRate,
  getMyEarnings,
  getAllVendorEarnings,
  markAsPaid,
  getPayoutHistory,
} = require('../controllers/earnings.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Commission rate
router.get('/commission', protect, getCommissionRate);
router.put('/commission', protect, authorize('super_admin'), updateCommissionRate);

// Vendor earnings (must come before parameterized routes)
router.get('/mine', protect, authorize('seller', 'saloon_admin'), getMyEarnings);

// SuperAdmin payout management
router.get('/admin/all', protect, authorize('super_admin'), getAllVendorEarnings);
router.post('/admin/pay', protect, authorize('super_admin'), markAsPaid);
router.get('/admin/history', protect, authorize('super_admin'), getPayoutHistory);

module.exports = router;
