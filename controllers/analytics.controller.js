const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const User = require('../models/User');
const Saloon = require('../models/Saloon');
const Barber = require('../models/Barber');
const { sendSuccess, sendError } = require('../utils/response');

const parseDays = (period) => {
  if (!period) return 30;
  const parsed = parseInt(String(period).replace(/\D/g, ''), 10);
  return isNaN(parsed) || parsed <= 0 ? 30 : parsed;
};

// GET /api/analytics/saloon/:id - Saloon admin dashboard
const getSaloonAnalytics = async (req, res, next) => {
  try {
    const { saloonId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(saloonId)) {
      return sendError(res, 400, 'Invalid saloon ID.');
    }

    const days = parseDays(req.query.period);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const sObjectId = new mongoose.Types.ObjectId(saloonId);

    const [
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      pendingAppointments,
      revenueData,
      barberCount,
      recentAppointments,
    ] = await Promise.all([
      Appointment.countDocuments({ saloon: sObjectId, date: { $gte: since } }),
      Appointment.countDocuments({ saloon: sObjectId, status: 'completed', date: { $gte: since } }),
      Appointment.countDocuments({ saloon: sObjectId, status: 'cancelled', date: { $gte: since } }),
      Appointment.countDocuments({ saloon: sObjectId, status: { $in: ['pending', 'confirmed'] } }),
      Appointment.aggregate([
        { $match: { saloon: sObjectId, status: 'completed', date: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      Barber.countDocuments({ saloon: sObjectId, isActive: true }),
      Appointment.find({ saloon: sObjectId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('customer', 'name avatar')
        .populate('service', 'name price')
        .populate({ path: 'barber', populate: { path: 'user', select: 'name' } }),
    ]);

    // Daily revenue chart (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyRevenue = await Appointment.aggregate([
      {
        $match: {
          saloon: sObjectId,
          status: 'completed',
          date: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return sendSuccess(res, 200, 'Analytics fetched.', {
      overview: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        pendingAppointments,
        totalRevenue: revenueData[0]?.total || 0,
        barberCount,
      },
      dailyRevenue,
      recentAppointments,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/global - Super admin overview
const getGlobalAnalytics = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalSaloons,
      verifiedSaloons,
      pendingSaloons,
      totalAppointments,
      totalOrders,
      globalRevenue,
      newUsersThisMonth,
    ] = await Promise.all([
      User.countDocuments(),
      Saloon.countDocuments(),
      Saloon.countDocuments({ isVerified: true }),
      Saloon.countDocuments({ isVerified: false }),
      Appointment.countDocuments(),
      Order.countDocuments(),
      Appointment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      User.countDocuments({
        createdAt: { $gte: new Date(new Date().setDate(1)) }, // Start of this month
      }),
    ]);

    // Monthly new users trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyUsers = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const roleBreakdown = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    return sendSuccess(res, 200, 'Global analytics fetched.', {
      overview: {
        totalUsers,
        totalSaloons,
        verifiedSaloons,
        pendingSaloons,
        totalAppointments,
        totalOrders,
        globalRevenue: globalRevenue[0]?.total || 0,
        newUsersThisMonth,
      },
      monthlyUsers,
      roleBreakdown,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/barber - Barber's own earnings
const getBarberAnalytics = async (req, res, next) => {
  try {
    const barber = await Barber.findOne({ user: req.user._id });
    if (!barber) return sendError(res, 404, 'Barber profile not found.');

    const days = parseDays(req.query.period);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalCompleted, earningsData, statusBreakdown] = await Promise.all([
      Appointment.countDocuments({ barber: barber._id, status: 'completed', date: { $gte: since } }),
      Appointment.aggregate([
        { $match: { barber: barber._id, status: 'completed', date: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { barber: barber._id, date: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return sendSuccess(res, 200, 'Barber analytics fetched.', {
      overview: {
        totalCompleted,
        totalEarnings: earningsData[0]?.total || 0,
        totalAppointments: barber.totalAppointments,
      },
      statusBreakdown,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/saloon/:saloonId/barbers-performance
const getSaloonBarbersPerformance = async (req, res, next) => {
  try {
    const { saloonId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(saloonId)) {
      return sendError(res, 400, 'Invalid saloon ID.');
    }
    
    // Check if the current user is the owner of this saloon or super_admin
    const saloon = await Saloon.findById(saloonId);
    if (!saloon) return sendError(res, 404, 'Saloon not found.');
    if (saloon.owner.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return sendError(res, 403, 'Unauthorized. Only the owner can view this.');
    }

    const days = parseDays(req.query.period);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const barbers = await Barber.find({ saloon: saloon._id }).populate('user', 'name email avatar');

    const result = [];
    for (const barber of barbers) {
      const stats = await Appointment.aggregate([
        { $match: { barber: barber._id, status: 'completed', date: { $gte: since } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, completedBookings: { $sum: 1 } } }
      ]);
      
      const cancelled = await Appointment.countDocuments({ barber: barber._id, status: 'cancelled', date: { $gte: since } });

      result.push({
        barberId: barber._id,
        name: barber.user?.name || 'Barber',
        email: barber.user?.email || '',
        avatar: barber.user?.avatar || null,
        totalRevenue: stats[0]?.totalRevenue || 0,
        completedBookings: stats[0]?.completedBookings || 0,
        cancelledBookings: cancelled
      });
    }

    return sendSuccess(res, 200, 'Barbers performance fetched.', { performance: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSaloonAnalytics, getGlobalAnalytics, getBarberAnalytics, getSaloonBarbersPerformance };
