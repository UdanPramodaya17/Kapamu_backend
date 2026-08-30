const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  getVendorOrders
} = require('../controllers/order.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createOrderSchema } = require('../schemas/product.schema');

router.post('/', protect, authorize('customer'), validate(createOrderSchema), createOrder);
router.get('/my', protect, authorize('customer'), getMyOrders);
router.get('/vendor', protect, authorize('saloon_admin', 'seller'), getVendorOrders);
router.get('/:id', protect, authorize('customer'), getOrder);
router.put('/:id/status', protect, authorize('saloon_admin', 'seller', 'super_admin'), updateOrderStatus);
router.delete('/:id', protect, authorize('customer'), cancelOrder);

module.exports = router;
