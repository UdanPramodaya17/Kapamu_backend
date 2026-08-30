const VendorEarning = require('../models/VendorEarning');
const PlatformSettings = require('../models/PlatformSettings');
const Seller = require('../models/Seller');
const Saloon = require('../models/Saloon');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/earnings/commission — Get current commission rate
const getCommissionRate = async (req, res, next) => {
  try {
    const rate = await PlatformSettings.getSetting('commissionRate', 10);
    return sendSuccess(res, 200, 'Commission rate fetched.', { commissionRate: rate });
  } catch (err) {
    next(err);
  }
};

// PUT /api/earnings/commission — SuperAdmin: update commission rate
const updateCommissionRate = async (req, res, next) => {
  try {
    const { commissionRate } = req.body;
    if (commissionRate === undefined || commissionRate < 0 || commissionRate > 100) {
      return sendError(res, 400, 'Commission rate must be between 0 and 100.');
    }

    await PlatformSettings.setSetting('commissionRate', Number(commissionRate), req.user._id);
    return sendSuccess(res, 200, `Commission rate updated to ${commissionRate}%.`, { commissionRate });
  } catch (err) {
    next(err);
  }
};

// GET /api/earnings/mine — Seller/SaloonAdmin: see own earnings
const getMyEarnings = async (req, res, next) => {
  try {
    let vendorId = null;
    let vendorModel = null;
    let bankDetails = null;

    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ owner: req.user._id });
      if (!seller) return sendError(res, 404, 'Seller profile not found.');
      vendorId = seller._id;
      vendorModel = 'Seller';
      bankDetails = seller.bankDetails;
    } else if (req.user.role === 'saloon_admin') {
      const saloon = await Saloon.findOne({ owner: req.user._id });
      if (!saloon) return sendError(res, 404, 'Saloon not found.');
      vendorId = saloon._id;
      vendorModel = 'Saloon';
      bankDetails = saloon.bankDetails;
    } else {
      return sendError(res, 403, 'Not authorized.');
    }

    const { page = 1, limit = 50, status } = req.query;
    const query = { vendorId };
    if (status && status !== 'all') query.status = status;

    // Get earnings records
    const earnings = await VendorEarning.find(query)
      .populate('orderId', 'createdAt status paymentStatus')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await VendorEarning.countDocuments(query);

    // Summary stats
    const [summaryResult] = await VendorEarning.aggregate([
      { $match: { vendorId, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$vendorAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalSales: { $sum: '$itemTotal' },
          count: { $sum: 1 },
        },
      },
    ]);

    const [pendingResult] = await VendorEarning.aggregate([
      { $match: { vendorId, status: 'pending' } },
      {
        $group: {
          _id: null,
          pendingAmount: { $sum: '$vendorAmount' },
          pendingCount: { $sum: 1 },
        },
      },
    ]);

    const [paidResult] = await VendorEarning.aggregate([
      { $match: { vendorId, status: 'paid' } },
      {
        $group: {
          _id: null,
          paidAmount: { $sum: '$vendorAmount' },
          paidCount: { $sum: 1 },
        },
      },
    ]);

    return sendSuccess(res, 200, 'Earnings fetched.', {
      earnings,
      pagination: { page: Number(page), limit: Number(limit), total },
      summary: {
        totalEarned: summaryResult?.totalEarned || 0,
        totalCommission: summaryResult?.totalCommission || 0,
        totalSales: summaryResult?.totalSales || 0,
        totalOrders: summaryResult?.count || 0,
        pendingAmount: pendingResult?.pendingAmount || 0,
        pendingCount: pendingResult?.pendingCount || 0,
        paidAmount: paidResult?.paidAmount || 0,
        paidCount: paidResult?.paidCount || 0,
      },
      bankDetails: bankDetails || {},
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/earnings/admin/all — SuperAdmin: all vendor earnings for payout management
const getAllVendorEarnings = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;

    // Aggregate by vendor
    const matchStage = {};
    if (status && status !== 'all') matchStage.status = status;

    const vendorSummaries = await VendorEarning.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { vendorId: '$vendorId', vendorModel: '$vendorModel' },
          totalAmount: { $sum: '$vendorAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalSales: { $sum: '$itemTotal' },
          count: { $sum: 1 },
          latestDate: { $max: '$createdAt' },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
    ]);

    // Populate vendor info
    const enriched = [];
    for (const item of vendorSummaries) {
      let vendor = null;
      if (item._id.vendorModel === 'Seller') {
        vendor = await Seller.findById(item._id.vendorId)
          .populate('owner', 'name email')
          .select('storeName contactPhone bankDetails owner');
      } else if (item._id.vendorModel === 'Saloon') {
        vendor = await Saloon.findById(item._id.vendorId)
          .populate('owner', 'name email')
          .select('name phone bankDetails owner');
      }
      enriched.push({
        vendorId: item._id.vendorId,
        vendorModel: item._id.vendorModel,
        vendorName: vendor?.storeName || vendor?.name || 'Unknown',
        ownerName: vendor?.owner?.name || '',
        ownerEmail: vendor?.owner?.email || '',
        bankDetails: vendor?.bankDetails || {},
        totalAmount: item.totalAmount,
        totalCommission: item.totalCommission,
        totalSales: item.totalSales,
        count: item.count,
        latestDate: item.latestDate,
      });
    }

    // Global stats
    const [globalStats] = await VendorEarning.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalPlatformSales: { $sum: '$itemTotal' },
          totalCommissionEarned: { $sum: '$commissionAmount' },
          totalVendorPayable: { $sum: '$vendorAmount' },
        },
      },
    ]);

    const [pendingStats] = await VendorEarning.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, amount: { $sum: '$vendorAmount' }, count: { $sum: 1 } } },
    ]);

    const [paidStats] = await VendorEarning.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, amount: { $sum: '$vendorAmount' }, count: { $sum: 1 } } },
    ]);

    const commissionRate = await PlatformSettings.getSetting('commissionRate', 10);

    return sendSuccess(res, 200, 'All vendor earnings fetched.', {
      vendors: enriched,
      globalStats: {
        totalPlatformSales: globalStats?.totalPlatformSales || 0,
        totalCommissionEarned: globalStats?.totalCommissionEarned || 0,
        totalVendorPayable: globalStats?.totalVendorPayable || 0,
        pendingPayoutAmount: pendingStats?.amount || 0,
        pendingPayoutCount: pendingStats?.count || 0,
        paidOutAmount: paidStats?.amount || 0,
        paidOutCount: paidStats?.count || 0,
      },
      commissionRate,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/earnings/admin/pay — SuperAdmin: mark vendor earnings as paid
const markAsPaid = async (req, res, next) => {
  try {
    const { vendorId, reference } = req.body;
    if (!vendorId) return sendError(res, 400, 'vendorId required.');

    const result = await VendorEarning.updateMany(
      { vendorId, status: 'pending' },
      {
        status: 'paid',
        paidAt: new Date(),
        paidReference: reference || '',
        paidBy: req.user._id,
      }
    );

    // In-App Notification to Vendor
    const { createNotification } = require('../utils/notify');
    const Seller = require('../models/Seller');
    const Saloon = require('../models/Saloon');

    const sendPayoutNote = (ownerId, link) => {
      createNotification({
        recipient: ownerId,
        sender: req.user._id,
        type: 'payout',
        title: 'Payout Processed! 💳',
        message: `Your marketplace earnings payout has been processed.${reference ? ` Ref: ${reference}` : ''}`,
        link,
      });
    };

    Seller.findById(vendorId).then(s => s?.owner && sendPayoutNote(s.owner, '/seller/earnings')).catch(console.error);
    Saloon.findById(vendorId).then(s => s?.owner && sendPayoutNote(s.owner, '/saloon-admin/earnings')).catch(console.error);

    return sendSuccess(res, 200, `${result.modifiedCount} earning records marked as paid.`, {
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/earnings/admin/history — SuperAdmin: payout history
const getPayoutHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const payouts = await VendorEarning.find({ status: 'paid' })
      .populate('paidBy', 'name')
      .sort({ paidAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await VendorEarning.countDocuments({ status: 'paid' });

    return sendSuccess(res, 200, 'Payout history fetched.', {
      payouts,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCommissionRate,
  updateCommissionRate,
  getMyEarnings,
  getAllVendorEarnings,
  markAsPaid,
  getPayoutHistory,
};
