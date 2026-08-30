const express = require('express');
const router = express.Router();
const {
  getSaloons,
  getSaloon,
  createSaloon,
  updateSaloon,
  verifySaloon,
  getMySaloon,
  getPendingSaloons,
  addHoliday,
  removeHoliday,
  deleteSaloon,
  toggleSaloonStatus,
  toggleRecommendedStatus,
  toggleTrendingStatus,
} = require('../controllers/saloon.controller');
const { getBarbersBySaloon } = require('../controllers/barber.controller');
const { getServicesBySaloon } = require('../controllers/service.controller');
const { getSaloonReviews } = require('../controllers/review.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', getSaloons);
router.get('/pending', protect, authorize('super_admin'), getPendingSaloons);
router.get('/my', protect, authorize('saloon_admin'), getMySaloon);
router.get('/:id', getSaloon);
router.get('/:id/barbers', getBarbersBySaloon);
router.get('/:saloonId/services', getServicesBySaloon);
router.get('/:saloonId/reviews', getSaloonReviews);
router.post('/', protect, authorize('super_admin'), createSaloon);
router.put('/:id', protect, authorize('saloon_admin'), updateSaloon);
router.put('/:id/verify', protect, authorize('super_admin'), verifySaloon);
router.post('/:id/holidays', protect, authorize('saloon_admin'), addHoliday);
router.delete('/:id/holidays/:holidayId', protect, authorize('saloon_admin'), removeHoliday);
router.delete('/:id', protect, authorize('super_admin'), deleteSaloon);
router.patch('/:id/status', protect, authorize('super_admin'), toggleSaloonStatus);
router.patch('/:id/recommended', protect, authorize('super_admin'), toggleRecommendedStatus);
router.patch('/:id/trending', protect, authorize('super_admin'), toggleTrendingStatus);

module.exports = router;
