const Saloon = require('../models/Saloon');
const User = require('../models/User');
const Barber = require('../models/Barber');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/saloons - Search/list saloons
const getSaloons = async (req, res, next) => {
  try {
    const {
      city,
      search,
      page = 1,
      limit = 12,
      lat,
      lng,
      radius = 10,
      all, // Super admin query
      recommended,
      trending,
    } = req.query;

    const query = {};
    if (all !== 'true') {
      query.isActive = true;
      query.isVerified = true;
    }

    if (recommended === 'true') {
      query.isRecommended = true;
    }
    if (trending === 'true') {
      query.isTrending = true;
    }

    if (city) query['address.city'] = new RegExp(city, 'i');
    if (search) query.name = new RegExp(search, 'i');

    let saloons;
    const skip = (Number(page) - 1) * Number(limit);

    if (lat && lng) {
      // Geo-location search
      saloons = await Saloon.find({
        ...query,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: Number(radius) * 1000,
          },
        },
      })
        .populate('owner', 'name email')
        .populate('services', 'name')
        .skip(skip)
        .limit(Number(limit));
    } else {
      saloons = await Saloon.find(query)
        .populate('owner', 'name email')
        .populate('services', 'name')
        .sort({ rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));
    }

    const total = await Saloon.countDocuments(query);

    return sendSuccess(res, 200, 'Saloons fetched.', {
      saloons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/saloons/:id
const getSaloon = async (req, res, next) => {
  try {
    const saloon = await Saloon.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('services');
    if (!saloon) return sendError(res, 404, 'Saloon not found.');
    return sendSuccess(res, 200, 'Saloon fetched.', { saloon });
  } catch (err) {
    next(err);
  }
};

// POST /api/saloons - super_admin creates saloon admin and their saloon
const createSaloon = async (req, res, next) => {
  try {
    const { ownerName, ownerEmail, ownerPassword, ownerPhone, ...saloonData } = req.body;

    if (!ownerEmail || !ownerPassword || !ownerName) {
      return sendError(res, 400, 'Owner details (ownerName, ownerEmail, ownerPassword) are required.');
    }

    const existingUser = await User.findOne({ email: ownerEmail });
    if (existingUser) return sendError(res, 409, 'Owner email already registered.');

    // 1. Create the Saloon Admin user
    const owner = await User.create({
      name: ownerName,
      email: ownerEmail,
      password: ownerPassword,
      phone: ownerPhone,
      role: 'saloon_admin',
    });

    const defaultOperatingHours = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      openTime: '09:00',
      closeTime: '21:00',
      isClosed: false,
    }));

    // 2. Create the Saloon
    const saloon = await Saloon.create({
      ...saloonData,
      name: saloonData.saloonName, // Map saloonName to name
      owner: owner._id,
      operatingHours: saloonData.operatingHours || defaultOperatingHours,
      isVerified: true, // Super admin created it, auto-verified
    });

    return sendSuccess(res, 201, 'Saloon and Saloon Admin created successfully.', { saloon });
  } catch (err) {
    next(err);
  }
};

// PUT /api/saloons/:id - Update saloon (own)
const updateSaloon = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ _id: req.params.id, owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'Saloon not found or not authorized.');

    Object.assign(saloon, req.body);
    await saloon.save();
    return sendSuccess(res, 200, 'Saloon updated.', { saloon });
  } catch (err) {
    next(err);
  }
};

// PUT /api/saloons/:id/verify - super_admin approves
const verifySaloon = async (req, res, next) => {
  try {
    const saloon = await Saloon.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    );
    if (!saloon) return sendError(res, 404, 'Saloon not found.');

    // In-App Notification to Saloon Owner
    if (saloon.owner) {
      const { createNotification } = require('../utils/notify');
      createNotification({
        recipient: saloon.owner,
        sender: req.user._id,
        type: 'system',
        title: 'Saloon Verified! 🎉',
        message: `Congratulations! "${saloon.name}" has been verified by the Super Admin and is now live.`,
        link: '/saloon-admin',
      });
    }

    return sendSuccess(res, 200, 'Saloon verified successfully.', { saloon });
  } catch (err) {
    next(err);
  }
};

// GET /api/saloons/my - Get saloon admin's own saloon
const getMySaloon = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ owner: req.user._id }).populate('services');
    if (!saloon) return sendError(res, 404, 'No saloon found.');
    return sendSuccess(res, 200, 'Saloon fetched.', { saloon });
  } catch (err) {
    next(err);
  }
};

// GET /api/saloons/pending - super_admin: list unverified saloons
const getPendingSaloons = async (req, res, next) => {
  try {
    const saloons = await Saloon.find({ isVerified: false }).populate('owner', 'name email');
    return sendSuccess(res, 200, 'Pending saloons fetched.', { saloons });
  } catch (err) {
    next(err);
  }
};

// POST /api/saloons/:id/holidays - Add a closing date
const addHoliday = async (req, res, next) => {
  try {
    const { date, reason } = req.body;
    if (!date) return sendError(res, 400, 'Holiday date is required.');

    const saloon = await Saloon.findOne({ _id: req.params.id, owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'Saloon not found or unauthorized.');

    saloon.holidays.push({ date, reason });
    await saloon.save();

    return sendSuccess(res, 200, 'Holiday added successfully.', { holidays: saloon.holidays });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/saloons/:id/holidays/:holidayId - Remove a closing date
const removeHoliday = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ _id: req.params.id, owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'Saloon not found or unauthorized.');

    saloon.holidays = saloon.holidays.filter(
      (h) => h._id.toString() !== req.params.holidayId
    );
    await saloon.save();

    return sendSuccess(res, 200, 'Holiday removed successfully.', { holidays: saloon.holidays });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/saloons/:id - Super admin deletes saloon completely
const deleteSaloon = async (req, res, next) => {
  try {
    const saloon = await Saloon.findById(req.params.id);
    if (!saloon) return sendError(res, 404, 'Saloon not found.');

    // Saloon admin (owner) ge user account ekath delete karanna
    if (saloon.owner) {
      const ownerId = saloon.owner._id || saloon.owner;
      await User.findByIdAndDelete(ownerId);
    }

    // 2. Barbers saha unge user accounts delete karanna
    const barbers = await Barber.find({ saloon: saloon._id });
    for (const barber of barbers) {
      if (barber.user) {
        const barberUserId = barber.user._id || barber.user;
        await User.findByIdAndDelete(barberUserId);
      }
      await barber.deleteOne();
    }

    await saloon.deleteOne();
    return sendSuccess(res, 200, 'Saloon completely deleted.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/saloons/:id/status - Super admin toggles active status
const toggleSaloonStatus = async (req, res, next) => {
  try {
    const saloon = await Saloon.findById(req.params.id);
    if (!saloon) return sendError(res, 404, 'Saloon not found.');

    saloon.isActive = !saloon.isActive;
    await saloon.save();

    // Saloon admin ge account ekath block/unblock karanna (login prevent kirimata)
    if (saloon.owner) {
      const ownerId = saloon.owner._id || saloon.owner;
      const owner = await User.findById(ownerId);
      if (owner) {
        owner.isActive = saloon.isActive;
        await owner.save();
      }
    }

    // 2. Saloon eke inna okkoma Barbers lawath block/unblock karanna
    const barbers = await Barber.find({ saloon: saloon._id });
    for (const barber of barbers) {
      if (barber.user) {
        const barberUserId = barber.user._id || barber.user;
        const barberUser = await User.findById(barberUserId);
        if (barberUser) {
          barberUser.isActive = saloon.isActive;
          await barberUser.save();
        }
      }
    }

    return sendSuccess(res, 200, `Saloon ${saloon.isActive ? 'unblocked' : 'blocked'} successfully.`);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/saloons/:id/recommended - Toggle Recommended Status
const toggleRecommendedStatus = async (req, res, next) => {
  try {
    const saloon = await Saloon.findById(req.params.id);
    if (!saloon) return sendError(res, 404, 'Saloon not found.');

    saloon.isRecommended = !saloon.isRecommended;
    await saloon.save();

    return sendSuccess(res, 200, `Saloon recommended status set to ${saloon.isRecommended}.`, { saloon });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/saloons/:id/trending - Toggle Trending Status
const toggleTrendingStatus = async (req, res, next) => {
  try {
    const saloon = await Saloon.findById(req.params.id);
    if (!saloon) return sendError(res, 404, 'Saloon not found.');

    saloon.isTrending = !saloon.isTrending;
    await saloon.save();

    return sendSuccess(res, 200, `Saloon trending status set to ${saloon.isTrending}.`, { saloon });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
