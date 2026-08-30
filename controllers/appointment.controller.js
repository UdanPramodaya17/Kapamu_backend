const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Barber = require('../models/Barber');
const { getAvailableSlots } = require('../services/availability.service');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/appointments/slots
const getSlots = async (req, res, next) => {
  try {
    const { saloonId, barberId, serviceId, date } = req.query;

    if (!saloonId || !serviceId || !date) {
      return sendError(res, 400, 'saloonId, serviceId, and date are required.');
    }

    const result = await getAvailableSlots({
      saloonId,
      barberId: barberId || 'any',
      serviceId,
      date,
    });
    return sendSuccess(res, 200, 'Available slots fetched.', result);
  } catch (err) {
    next(err);
  }
};

// POST /api/appointments - Customer books
const createAppointment = async (req, res, next) => {
  try {
    const { saloon, barber, service: serviceId, date, startTime, notes, paymentMethod } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) return sendError(res, 404, 'Service not found.');

    let resolvedBarberId = barber;

    // Handle "Any Stylist" load-balanced auto-assignment
    if (!resolvedBarberId || resolvedBarberId === 'any') {
      const slotsResult = await getAvailableSlots({
        saloonId: saloon,
        barberId: 'any',
        serviceId,
        date,
      });

      const matchedSlot = slotsResult.slots?.find((s) => s.startTime === startTime);
      if (!matchedSlot || !matchedSlot.availableBarbers || matchedSlot.availableBarbers.length === 0) {
        return sendError(res, 409, 'Selected slot is no longer available.');
      }

      // Load balancing: find the barber with least existing appointments on that date
      const candidateBarberIds = matchedSlot.availableBarbers.map((b) => b._id);

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const appointmentCounts = await Promise.all(
        candidateBarberIds.map(async (bId) => {
          const count = await Appointment.countDocuments({
            barber: bId,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ['pending', 'confirmed'] },
          });
          return { barberId: bId, count };
        })
      );

      appointmentCounts.sort((a, b) => a.count - b.count);
      resolvedBarberId = appointmentCounts[0].barberId;
    } else {
      // Re-validate slot availability for specific barber
      const slotsResult = await getAvailableSlots({
        saloonId: saloon,
        barberId: resolvedBarberId,
        serviceId,
        date,
      });
      const isAvailable = slotsResult.slots?.some((s) => s.startTime === startTime);
      if (!isAvailable) {
        return sendError(res, 409, 'Selected slot is no longer available.');
      }
    }

    // Calculate end time
    const [h, m] = startTime.split(':').map(Number);
    const endMinutes = h * 60 + m + service.duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const appointment = await Appointment.create({
      customer: req.user._id,
      saloon,
      barber: resolvedBarberId,
      service: serviceId,
      date: new Date(date),
      startTime,
      endTime,
      totalAmount: service.price,
      notes,
      paymentMethod,
    });

    // Increment barber appointment count
    await Barber.findByIdAndUpdate(resolvedBarberId, { $inc: { totalAppointments: 1 } });

    const populated = await appointment.populate([
      { path: 'barber', populate: { path: 'user', select: 'name avatar phone email' } },
      { path: 'service', select: 'name duration price' },
      { path: 'saloon', select: 'name address' },
    ]);

    // Send SMS Notification to customer if phone number is available
    if (req.user && req.user.phone) {
      const { sendSMS } = require('../utils/sms');
      const saloonName = populated.saloon?.name || 'our Saloon';
      const serviceName = populated.service?.name || 'Service';
      const barberName = populated.barber?.user?.name || 'stylist';
      const formattedDate = new Date(date).toLocaleDateString();

      const smsMessage = `Hi ${req.user.name}, your appointment for ${serviceName} with ${barberName} at ${saloonName} is booked for ${formattedDate} at ${startTime}. Thank you!`;
      sendSMS(req.user.phone, smsMessage).catch(console.error);
    }

    // Send SMS Notification to Barber if phone is available
    if (populated.barber?.user?.phone) {
      const { sendSMS } = require('../utils/sms');
      const customerName = req.user.name || 'A customer';
      const serviceName = populated.service?.name || 'Service';
      const formattedDate = new Date(date).toLocaleDateString();

      const barberMsg = `New Booking! ${customerName} has booked ${serviceName} with you for ${formattedDate} at ${startTime}.`;
      sendSMS(populated.barber.user.phone, barberMsg).catch(console.error);
    }

    // In-App Notifications
    const { createNotification } = require('../utils/notify');
    const Saloon = require('../models/Saloon');
    const d = new Date(date);
    const dateParam = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';

    if (populated.barber?.user?._id) {
      createNotification({
        recipient: populated.barber.user._id,
        sender: req.user._id,
        type: 'booking',
        title: 'New Booking Assigned ✂️',
        message: `${req.user.name || 'A client'} booked ${populated.service?.name || 'Service'} on ${new Date(date).toLocaleDateString()} at ${startTime}.`,
        link: `/barber/appointments?date=${dateParam}&appointmentId=${appointment._id}`,
      });
    }

    Saloon.findById(saloon).then(s => {
      if (s?.owner) {
        createNotification({
          recipient: s.owner,
          sender: req.user._id,
          type: 'booking',
          title: 'New Saloon Booking 📅',
          message: `${req.user.name || 'A client'} booked ${populated.service?.name} with ${populated.barber?.user?.name || 'Stylist'}.`,
          link: `/saloon-admin/bookings?date=${dateParam}&appointmentId=${appointment._id}`,
        });
      }
    }).catch(console.error);

    return sendSuccess(res, 201, 'Appointment booked successfully.', { appointment: populated });
  } catch (err) {
    next(err);
  }
};

// GET /api/appointments - Customer's own appointments
const getMyAppointments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { customer: req.user._id };
    if (status) query.status = status;

    const appointments = await Appointment.find(query)
      .populate({ path: 'barber', populate: { path: 'user', select: 'name avatar' } })
      .populate('service', 'name duration price')
      .populate('saloon', 'name address images')
      .sort({ date: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Appointment.countDocuments(query);
    return sendSuccess(res, 200, 'Appointments fetched.', {
      appointments,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/appointments/barber - Barber's schedule & appointment records
const getBarberAppointments = async (req, res, next) => {
  try {
    const barber = await Barber.findOne({ user: req.user._id });
    if (!barber) return sendError(res, 404, 'Barber profile not found.');

    const { date, status, page = 1, limit = 50 } = req.query;
    const query = { barber: barber._id };
    if (status && status !== 'all') query.status = status;
    if (date && date !== 'all') {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: d, $lte: end };
    }

    const sortOrder = date && date !== 'all' ? { date: 1, startTime: 1 } : { date: -1, startTime: -1 };

    const appointments = await Appointment.find(query)
      .populate('customer', 'name email phone avatar')
      .populate('service', 'name duration price')
      .sort(sortOrder)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Appointment.countDocuments(query);

    return sendSuccess(res, 200, 'Schedule fetched.', { appointments, total });
  } catch (err) {
    next(err);
  }
};

// GET /api/appointments/saloon - Saloon admin's appointments
const getSaloonAppointments = async (req, res, next) => {
  try {
    const { saloonId, date, status, page = 1, limit = 20 } = req.query;
    const query = { saloon: saloonId };
    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: d, $lte: end };
    }

    const appointments = await Appointment.find(query)
      .populate('customer', 'name email phone avatar')
      .populate({ path: 'barber', populate: { path: 'user', select: 'name avatar' } })
      .populate('service', 'name duration price')
      .sort({ date: 1, startTime: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return sendSuccess(res, 200, 'Appointments fetched.', { appointments });
  } catch (err) {
    next(err);
  }
};

// PUT /api/appointments/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, cancelReason } = req.body;
    const appointment = await Appointment.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('saloon', 'name')
      .populate('service', 'name');

    if (!appointment) return sendError(res, 404, 'Appointment not found.');

    const oldStatus = appointment.status;

    // barbers can update their own appointments; saloon_admin can update saloon's
    appointment.status = status;
    if (cancelReason) appointment.cancelReason = cancelReason;
    await appointment.save();

    if (status === 'confirmed' && oldStatus === 'pending') {
      const { sendEmail } = require('../utils/email');
      const { getAppointmentConfirmedEmail } = require('../utils/emailTemplates');

      const formattedDate = new Date(appointment.date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      const emailHtml = getAppointmentConfirmedEmail({
        customerName: appointment.customer?.name || 'Valued Client',
        saloonName: appointment.saloon?.name || 'Selected Saloon',
        serviceName: appointment.service?.name || 'Haircut & Styling',
        date: formattedDate,
        time: `${appointment.startTime} - ${appointment.endTime}`,
        barberName: appointment.barber?.user?.name || null,
        totalAmount: appointment.totalAmount,
      });

      // We don't await to avoid blocking the response
      sendEmail({
        email: appointment.customer?.email,
        subject: `KAPAMU — Appointment Confirmed at ${appointment.saloon?.name || 'Saloon'}`,
        html: emailHtml,
      }).catch(console.error);

      // Send SMS
      if (appointment.customer?.phone) {
        const { sendSMS } = require('../utils/sms');
        const saloonName = appointment.saloon?.name || 'our Saloon';
        const serviceName = appointment.service?.name || 'Service';
        const formattedDate = new Date(appointment.date).toLocaleDateString();
        
        const smsMessage = `Hi ${appointment.customer?.name}, your appointment for ${serviceName} at ${saloonName} on ${formattedDate} at ${appointment.startTime} has been CONFIRMED. See you soon!`;
        
        sendSMS(appointment.customer.phone, smsMessage).catch(console.error);
      }
    }

    // Send SMS when status is completed
    if (status === 'completed' && oldStatus !== 'completed' && appointment.customer?.phone) {
      const { sendSMS } = require('../utils/sms');
      const saloonName = appointment.saloon?.name || 'our Saloon';
      const serviceName = appointment.service?.name || 'Service';
      
      const smsMessage = `Hi ${appointment.customer?.name}, your appointment for ${serviceName} at ${saloonName} is marked COMPLETED. Thank you for visiting!`;
      
      sendSMS(appointment.customer.phone, smsMessage).catch(console.error);
    }

    // Send SMS when status is cancelled
    if (status === 'cancelled' && oldStatus !== 'cancelled' && appointment.customer?.phone) {
      const { sendSMS } = require('../utils/sms');
      const saloonName = appointment.saloon?.name || 'our Saloon';
      const reasonText = cancelReason ? ` Reason: ${cancelReason}` : '';
      
      const smsMessage = `Hi ${appointment.customer?.name}, your appointment at ${saloonName} has been CANCELLED.${reasonText}`;
      
      sendSMS(appointment.customer.phone, smsMessage).catch(console.error);
    }

    // In-App Notification to Customer
    if (appointment.customer?._id) {
      const { createNotification } = require('../utils/notify');
      const d = new Date(appointment.date);
      const dateParam = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      const statusTitles = {
        confirmed: 'Booking Confirmed! ✅',
        cancelled: 'Booking Cancelled ❌',
        completed: 'Appointment Completed ✨',
      };
      const statusMsgs = {
        confirmed: `Your booking for ${appointment.service?.name || 'Service'} at ${appointment.saloon?.name || 'Saloon'} has been confirmed.`,
        cancelled: `Your booking was cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
        completed: `Thank you for visiting ${appointment.saloon?.name || 'our saloon'}! Please leave a review.`,
      };

      if (statusTitles[status]) {
        createNotification({
          recipient: appointment.customer._id,
          sender: req.user._id,
          type: 'booking',
          title: statusTitles[status],
          message: statusMsgs[status],
          link: `/customer/bookings?date=${dateParam}&appointmentId=${appointment._id}`,
        });
      }
    }

    return sendSuccess(res, 200, 'Appointment status updated.', { appointment });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/appointments/:id - Customer cancels
const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });
    if (!appointment) return sendError(res, 404, 'Appointment not found.');
    if (['confirmed', 'completed', 'cancelled'].includes(appointment.status)) {
      return sendError(res, 400, 'Cannot cancel a confirmed or completed appointment.');
    }

    appointment.status = 'cancelled';
    appointment.cancelReason = req.body.cancelReason || 'Customer cancelled.';
    await appointment.save();

    return sendSuccess(res, 200, 'Appointment cancelled.', { appointment });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSlots,
  createAppointment,
  getMyAppointments,
  getBarberAppointments,
  getSaloonAppointments,
  updateStatus,
  cancelAppointment,
};
