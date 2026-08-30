const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/seller.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Super Admin Routes
router.post('/', protect, authorize('super_admin'), sellerController.createSeller);
router.get('/all', protect, authorize('super_admin'), sellerController.getAllSellers);
router.put('/:id/status', protect, authorize('super_admin'), sellerController.toggleSellerStatus);

// Seller Routes
router.get('/my', protect, authorize('seller'), sellerController.getMySellerProfile);
router.put('/my', protect, authorize('seller'), sellerController.updateMySellerProfile);

module.exports = router;
