const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  getMyProducts,
  getPendingProducts,
  createProduct,
  updateProduct,
  approveProduct,
  rejectProduct,
  deleteProduct,
} = require('../controllers/product.controller');
const {
  createProductReview,
  getProductReviews,
} = require('../controllers/review.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createProductSchema } = require('../schemas/product.schema');

// IMPORTANT: Specific static routes MUST come before parameterized routes (/:id)
// to prevent 'mine' and 'admin' being treated as IDs.

// Vendor: view their own products (all statuses) — must be before /:id
router.get('/mine', protect, authorize('saloon_admin', 'seller'), getMyProducts);

// SuperAdmin: review all products with status filter — must be before /:id
router.get('/admin/all', protect, authorize('super_admin'), getPendingProducts);

// Public
router.get('/', getProducts);
router.get('/:id', getProduct);
router.get('/:productId/reviews', getProductReviews);
router.post('/:productId/reviews', protect, createProductReview);

// Create / Update / Delete
router.post('/', protect, authorize('saloon_admin', 'super_admin', 'seller'), validate(createProductSchema), createProduct);
router.put('/:id', protect, authorize('saloon_admin', 'super_admin', 'seller'), updateProduct);
router.delete('/:id', protect, authorize('saloon_admin', 'super_admin', 'seller'), deleteProduct);

// SuperAdmin: approve / reject
router.patch('/:id/approve', protect, authorize('super_admin'), approveProduct);
router.patch('/:id/reject', protect, authorize('super_admin'), rejectProduct);

module.exports = router;
