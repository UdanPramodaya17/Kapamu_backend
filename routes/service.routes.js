const express = require('express');
const router = express.Router();
const {
  getService,
  createService,
  updateService,
  deleteService,
} = require('../controllers/service.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/:id', getService);
router.post('/', protect, authorize('saloon_admin'), createService);
router.put('/:id', protect, authorize('saloon_admin'), updateService);
router.delete('/:id', protect, authorize('saloon_admin'), deleteService);

module.exports = router;
