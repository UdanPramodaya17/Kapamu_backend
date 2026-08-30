const express = require('express');
const router = express.Router();
const {
  getSlots,
  createAppointment,
  getMyAppointments,
  getBarberAppointments,
  getSaloonAppointments,
  updateStatus,
  cancelAppointment,
} = require('../controllers/appointment.controller');
const { createAppointmentReview } = require('../controllers/review.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createAppointmentSchema, updateStatusSchema } = require('../schemas/appointment.schema');
router.get('/slots', getSlots);
router.get('/my', protect, authorize('customer'), getMyAppointments);
router.get('/barber', protect, authorize('barber'), getBarberAppointments);
router.get('/saloon', protect, authorize('saloon_admin', 'super_admin'), getSaloonAppointments);
router.post('/', protect, authorize('customer'), validate(createAppointmentSchema), createAppointment);
router.put('/:id/status', protect, authorize('barber', 'saloon_admin', 'super_admin'), validate(updateStatusSchema), updateStatus);
router.delete('/:id', protect, authorize('customer'), cancelAppointment);
router.post('/:appointmentId/reviews', protect, authorize('customer'), createAppointmentReview);
 
module.exports = router;
