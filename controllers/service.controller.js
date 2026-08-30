const Service = require('../models/Service');
const Saloon = require('../models/Saloon');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/saloons/:saloonId/services
const getServicesBySaloon = async (req, res, next) => {
  try {
    const services = await Service.find({ saloon: req.params.saloonId, isActive: true });
    return sendSuccess(res, 200, 'Services fetched.', { services });
  } catch (err) {
    next(err);
  }
};

// GET /api/services/:id
const getService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id).populate('saloon', 'name');
    if (!service) return sendError(res, 404, 'Service not found.');
    return sendSuccess(res, 200, 'Service fetched.', { service });
  } catch (err) {
    next(err);
  }
};

// POST /api/services - saloon_admin creates
const createService = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'No saloon found.');

    const service = await Service.create({ ...req.body, saloon: saloon._id });

    // Add service to saloon
    saloon.services.push(service._id);
    await saloon.save();

    return sendSuccess(res, 201, 'Service created.', { service });
  } catch (err) {
    next(err);
  }
};

// PUT /api/services/:id
const updateService = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'No saloon found.');

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, saloon: saloon._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!service) return sendError(res, 404, 'Service not found or not authorized.');
    return sendSuccess(res, 200, 'Service updated.', { service });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/services/:id
const deleteService = async (req, res, next) => {
  try {
    const saloon = await Saloon.findOne({ owner: req.user._id });
    if (!saloon) return sendError(res, 404, 'No saloon found.');

    await Service.findOneAndUpdate(
      { _id: req.params.id, saloon: saloon._id },
      { isActive: false }
    );
    return sendSuccess(res, 200, 'Service deactivated.');
  } catch (err) {
    next(err);
  }
};

module.exports = { getServicesBySaloon, getService, createService, updateService, deleteService };
