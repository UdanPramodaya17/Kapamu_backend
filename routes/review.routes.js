const express = require('express');
const router = express.Router();
const { getAllReviews, deleteReview, toggleFeaturedReview, getFeaturedReviews } = require('../controllers/review.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Public featured reviews
router.get('/featured', getFeaturedReviews);

// Super Admin reviews management
router.get('/', protect, authorize('super_admin'), getAllReviews);
router.delete('/:reviewId', protect, authorize('super_admin'), deleteReview);
router.patch('/:reviewId/featured', protect, authorize('super_admin'), toggleFeaturedReview);

module.exports = router;
