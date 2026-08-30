const express = require('express');
const router = express.Router();
const {
  getSaloonAnalytics,
  getGlobalAnalytics,
  getBarberAnalytics,
  getSaloonBarbersPerformance,
} = require('../controllers/analytics.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/global', protect, authorize('super_admin'), getGlobalAnalytics);
router.get('/barber', protect, authorize('barber'), getBarberAnalytics);
router.get('/saloon/:saloonId', protect, authorize('saloon_admin', 'super_admin'), getSaloonAnalytics);
router.get('/saloon/:saloonId/barbers-performance', protect, authorize('saloon_admin', 'super_admin'), getSaloonBarbersPerformance);

module.exports = router;
