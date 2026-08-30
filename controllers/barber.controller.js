const Barber = require('../models/Barber');
const User = require('../models/User');
const Saloon = require('../models/Saloon');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/saloons/:id/barbers
const getBarbersBySaloon = async (req, res, next) => {
  try {
    const { all } = req.query;
    const query = { saloon: req.params.id };
    if (all !== 'true') query.isActive = true;
    const barbers = await Barber.find(query)
      .populate('user', 'name email avatar phone');
    return sendSuccess(res, 200, 'Barbers fetched.', { barbers });
  } catch (err) {
    next(err);
  }
};

// GET /api/barbers/:id
const getBarber = async (req, res, next) => {
  try {
    const barber = await Barber.findById(req.params.id)
      .populate('user', 'name email avatar phone')
      .populate('saloon', 'name address');
    if (!barber) return sendError(res, 404, 'Barber not found.');
    return sendSuccess(res, 200, 'Barber fetched.', { barber });
  } catch (err) {
    next(err);
  }
};

// POST /api/barbers - saloon_admin adds barber
const addBarber = async (req, res, next) => {
  try {
    const { name, email, password, phone, specializations, bio, workingHours } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 400, 'Barber account details (name, email, password) are required.');
    }

    const saloon = await Saloon.findOne({ owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'No saloon found for your account.');

    const existingUser = await User.findOne({ email });
    if (existingUser) return sendError(res, 409, 'Barber email already registered.');

    // 1. Create Barber User
    const barberUser = await User.create({
      name,
      email,
      password,
      phone,
      role: 'barber',
    });

    // 2. Create Barber Profile
    const barber = await Barber.create({
      user: barberUser._id,
      saloon: saloon._id,
      specializations,
      bio,
      workingHours,
    });

    return sendSuccess(res, 201, 'Barber registered and added to your saloon.', { barber });
  } catch (err) {
    next(err);
  }
};

// PUT /api/barbers/:id/leave - barber marks leave
const markLeave = async (req, res, next) => {
  try {
    const barber = await Barber.findOne({ user: req.user._id });
    if (!barber) return sendError(res, 404, 'Barber profile not found.');

    const { date, startTime, endTime, isFullDay, reason } = req.body;

    barber.leaveSchedule.push({ date, startTime, endTime, isFullDay, reason, status: 'pending' });
    await barber.save();

    return sendSuccess(res, 200, 'Leave marked successfully.', {
      leaveSchedule: barber.leaveSchedule,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/barbers/leave/:leaveId - barber cancels leave
const cancelLeave = async (req, res, next) => {
  try {
    const barber = await Barber.findOne({ user: req.user._id });
    if (!barber) return sendError(res, 404, 'Barber profile not found.');

    barber.leaveSchedule = barber.leaveSchedule.filter(
      (l) => l._id.toString() !== req.params.leaveId
    );
    await barber.save();

    return sendSuccess(res, 200, 'Leave cancelled.', { leaveSchedule: barber.leaveSchedule });
  } catch (err) {
    next(err);
  }
};

// GET /api/barbers/me - barber's own profile
const getMyProfile = async (req, res, next) => {
  try {
    const barber = await Barber.findOne({ user: req.user._id })
      .populate('saloon', 'name address operatingHours');
    if (!barber) return sendError(res, 404, 'Barber profile not found.');
    return sendSuccess(res, 200, 'Profile fetched.', { barber });
  } catch (err) {
    next(err);
  }
};

// PUT /api/barbers/me - update barber profile
const updateMyProfile = async (req, res, next) => {
  try {
    const barber = await Barber.findOneAndUpdate(
       { user: req.user._id },
       req.body,
       { new: true, runValidators: true }
    ).populate('user', 'name email avatar phone');
    if (!barber) return sendError(res, 404, 'Barber profile not found.');

    // Sync avatar to User model
    if (req.body.avatar !== undefined) {
      await User.findByIdAndUpdate(req.user._id, { avatar: req.body.avatar });
      if (barber.user) barber.user.avatar = req.body.avatar;
    }

    return sendSuccess(res, 200, 'Profile updated.', { barber });
  } catch (err) {
    next(err);
  }
};

// PUT /api/barbers/:id/admin-update - Saloon Admin updates barber profile
const updateBarberProfileByAdmin = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'No saloon found.');

    const barber = await Barber.findOneAndUpdate(
      { _id: req.params.id, saloon: saloon._id },
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email avatar phone');
    if (!barber) return sendError(res, 404, 'Barber not found or unauthorized.');

    // Sync avatar to User model
    if (req.body.avatar !== undefined && barber.user) {
      const barberUserId = barber.user._id || barber.user;
      await User.findByIdAndUpdate(barberUserId, { avatar: req.body.avatar });
      if (typeof barber.user === 'object') barber.user.avatar = req.body.avatar;
    }
    
    return sendSuccess(res, 200, 'Barber profile updated by admin.', { barber });
  } catch (err) {
    next(err);
  }
};

// PUT /api/barbers/:id/leave/:leaveId/status - Saloon Admin approve/reject leave
const updateLeaveStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return sendError(res, 400, 'Invalid status.');
    }

    const barber = await Barber.findById(req.params.id).populate('saloon');
    if (!barber) return sendError(res, 404, 'Barber not found.');

    if (barber.saloon.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Unauthorized to manage leaves for this barber.');
    }

    const leave = barber.leaveSchedule.id(req.params.leaveId);
    if (!leave) return sendError(res, 404, 'Leave request not found.');

    leave.status = status;
    await barber.save();

    return sendSuccess(res, 200, `Leave ${status} successfully.`, { leaveSchedule: barber.leaveSchedule });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/barbers/:id - Saloon admin deletes barber
const deleteBarber = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'No saloon found.');

    const barber = await Barber.findOne({ _id: req.params.id, saloon: saloon._id });
    if (!barber) return sendError(res, 404, 'Barber not found or unauthorized.');

    if (barber.user) {
      const userId = barber.user._id || barber.user;
      await User.findByIdAndDelete(userId);
    }
    await barber.deleteOne();

    return sendSuccess(res, 200, 'Barber completely deleted.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/barbers/:id/status - Saloon admin toggles active status
const toggleBarberStatus = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'No saloon found.');

    const barber = await Barber.findOne({ _id: req.params.id, saloon: saloon._id });
    if (!barber) return sendError(res, 404, 'Barber not found or unauthorized.');

    barber.isActive = barber.isActive === false ? true : false;
    await barber.save();

    if (barber.user) {
      const userId = barber.user._id || barber.user;
      const user = await User.findById(userId);
      if (user) {
        user.isActive = barber.isActive;
        await user.save();
      }
    }

    return sendSuccess(res, 200, `Barber ${barber.isActive ? 'unblocked' : 'blocked'} successfully.`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBarbersBySaloon,
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
};
