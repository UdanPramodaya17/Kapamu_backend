const express = require('express');
const router = express.Router();
const {
  getBarber,
  addBarber,
  markLeave,
  cancelLeave,
  getMyProfile,
  updateMyProfile,
  updateLeaveStatus,
  deleteBarber,
  toggleBarberStatus,
  updateBarberProfileByAdmin,
} = require('../controllers/barber.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/me', protect, authorize('barber'), getMyProfile);
router.put('/me', protect, authorize('barber'), updateMyProfile);
router.get('/:id', getBarber);
router.post('/', protect, authorize('saloon_admin'), addBarber);
router.put('/:id/leave', protect, authorize('barber'), markLeave);
router.put('/:id/leave/:leaveId/status', protect, authorize('saloon_admin'), updateLeaveStatus);
router.delete('/leave/:leaveId', protect, authorize('barber'), cancelLeave);
router.put('/:id/admin-update', protect, authorize('saloon_admin'), updateBarberProfileByAdmin);
router.delete('/:id', protect, authorize('saloon_admin'), deleteBarber);
router.patch('/:id/status', protect, authorize('saloon_admin'), toggleBarberStatus);

module.exports = router;
