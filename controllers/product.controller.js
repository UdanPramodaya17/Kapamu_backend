const Product = require('../models/Product');
const Saloon = require('../models/Saloon');
const Seller = require('../models/Seller');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/products  — PUBLIC: Only approved + active products
const getProducts = async (req, res, next) => {
  try {
    const { category, search, vendorId, page = 1, limit = 12 } = req.query;
    const query = { isActive: true, status: 'approved' };

    if (category) query.category = category;
    if (vendorId) query.vendorId = vendorId;
    if (search) query.name = new RegExp(search, 'i');

    const products = await Product.find(query)
      .populate('vendorId', 'name storeName')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Product.countDocuments(query);
    return sendSuccess(res, 200, 'Products fetched.', {
      products,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendorId', 'name storeName');
    if (!product) return sendError(res, 404, 'Product not found.');
    return sendSuccess(res, 200, 'Product fetched.', { product });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/mine — Seller/SaloonAdmin: their own products (all statuses)
const getMyProducts = async (req, res, next) => {
  try {
    let vendorId = null;

    if (req.user.role === 'saloon_admin') {
      const saloon = await Saloon.findOne({ owner: req.user._id });
      if (!saloon) return sendError(res, 404, 'No saloon found.');
      vendorId = saloon._id;
    } else if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ owner: req.user._id });
      if (!seller) return sendError(res, 404, 'No seller profile found.');
      vendorId = seller._id;
    }

    const query = { isActive: true };
    if (vendorId) query.vendorId = vendorId;

    const { page = 1, limit = 100 } = req.query;
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Product.countDocuments(query);
    return sendSuccess(res, 200, 'Your products fetched.', {
      products,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/pending — SuperAdmin: all pending products for review
const getPendingProducts = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;
    const query = { status };

    const products = await Product.find(query)
      .populate('vendorId', 'name storeName contactPhone')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    // Count stats
    const pendingCount = await Product.countDocuments({ status: 'pending' });
    const approvedCount = await Product.countDocuments({ status: 'approved' });
    const rejectedCount = await Product.countDocuments({ status: 'rejected' });

    return sendSuccess(res, 200, 'Products fetched for review.', {
      products,
      pagination: { page: Number(page), limit: Number(limit), total },
      stats: { pending: pendingCount, approved: approvedCount, rejected: rejectedCount },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    let vendorId = null;
    let vendorModel = 'Saloon'; // default
    let status = 'pending'; // All seller/saloon products start as pending

    if (req.user.role === 'saloon_admin') {
      const saloon = await Saloon.findOne({ owner: req.user._id });
      if (!saloon) return sendError(res, 404, 'No saloon found.');
      vendorId = saloon._id;
      vendorModel = 'Saloon';
    } else if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ owner: req.user._id });
      if (!seller) return sendError(res, 404, 'No seller profile found.');
      vendorId = seller._id;
      vendorModel = 'Seller';
    } else if (req.user.role === 'super_admin') {
      vendorModel = null;
      status = 'approved'; // SuperAdmin products are auto-approved
    }

    const product = await Product.create({ ...req.body, vendorId, vendorModel, status });

    // In-App Notification to Super Admins when seller/saloon submits product
    if (status === 'pending') {
      const { createNotification } = require('../utils/notify');
      const User = require('../models/User');

      User.find({ role: 'super_admin' }).then(superAdmins => {
        for (const admin of superAdmins) {
          createNotification({
            recipient: admin._id,
            sender: req.user._id,
            type: 'order',
            title: 'New Product Pending Approval 🛍️',
            message: `${req.user.name || 'A vendor'} submitted "${product.name}" for review.`,
            link: '/admin/products',
          });
        }
      }).catch(console.error);
    }

    return sendSuccess(res, 201, 'Product submitted for approval.', { product });
  } catch (err) {
    next(err);
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    
    if (req.user.role === 'saloon_admin') {
      const saloon = await Saloon.findOne({ owner: req.user._id });
      if (!saloon) return sendError(res, 404, 'No saloon found.');
      query.vendorId = saloon._id;
    } else if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ owner: req.user._id });
      if (!seller) return sendError(res, 404, 'No seller profile found.');
      query.vendorId = seller._id;
    }

    // When a seller/saloon edits a product, reset to pending for re-review
    const updateData = { ...req.body };
    if (req.user.role !== 'super_admin') {
      updateData.status = 'pending';
      updateData.rejectionReason = '';
    }

    const product = await Product.findOneAndUpdate(query, updateData, { new: true, runValidators: true });
    if (!product) return sendError(res, 404, 'Product not found or not authorized.');

    // Notify Super Admins if resubmitted
    if (updateData.status === 'pending') {
      const { createNotification } = require('../utils/notify');
      const User = require('../models/User');

      User.find({ role: 'super_admin' }).then(superAdmins => {
        for (const admin of superAdmins) {
          createNotification({
            recipient: admin._id,
            sender: req.user._id,
            type: 'order',
            title: 'Product Updated & Resubmitted 🛍️',
            message: `${req.user.name || 'A vendor'} updated and resubmitted "${product.name}".`,
            link: '/admin/products',
          });
        }
      }).catch(console.error);
    }

    return sendSuccess(res, 200, 'Product updated and resubmitted for approval.', { product });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/products/:id/approve — SuperAdmin only
const approveProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', rejectionReason: '' },
      { new: true }
    );
    if (!product) return sendError(res, 404, 'Product not found.');

    // In-App Notification to Vendor (Seller or Saloon Owner)
    if (product.vendorId && product.vendorModel) {
      const { createNotification } = require('../utils/notify');

      if (product.vendorModel === 'Seller') {
        Seller.findById(product.vendorId).then(seller => {
          if (seller?.owner) {
            createNotification({
              recipient: seller.owner,
              sender: req.user._id,
              type: 'order',
              title: 'Product Approved! ✅',
              message: `Your product "${product.name}" has been approved and is now live on the marketplace.`,
              link: '/seller/products',
            });
          }
        }).catch(console.error);
      } else if (product.vendorModel === 'Saloon') {
        Saloon.findById(product.vendorId).then(saloon => {
          if (saloon?.owner) {
            createNotification({
              recipient: saloon.owner,
              sender: req.user._id,
              type: 'order',
              title: 'Product Approved! ✅',
              message: `Your product "${product.name}" has been approved and is now live on the marketplace.`,
              link: '/saloon-admin/products',
            });
          }
        }).catch(console.error);
      }
    }

    return sendSuccess(res, 200, 'Product approved and is now live.', { product });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/products/:id/reject — SuperAdmin only
const rejectProduct = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason: reason || 'Does not meet our standards.' },
      { new: true }
    );
    if (!product) return sendError(res, 404, 'Product not found.');

    // In-App Notification to Vendor (Seller or Saloon Owner)
    if (product.vendorId && product.vendorModel) {
      const { createNotification } = require('../utils/notify');
      const rejectionNote = reason || 'Does not meet quality standards.';

      if (product.vendorModel === 'Seller') {
        Seller.findById(product.vendorId).then(seller => {
          if (seller?.owner) {
            createNotification({
              recipient: seller.owner,
              sender: req.user._id,
              type: 'order',
              title: 'Product Not Approved ⚠️',
              message: `Your product "${product.name}" was not approved. Reason: ${rejectionNote}`,
              link: '/seller/products',
            });
          }
        }).catch(console.error);
      } else if (product.vendorModel === 'Saloon') {
        Saloon.findById(product.vendorId).then(saloon => {
          if (saloon?.owner) {
            createNotification({
              recipient: saloon.owner,
              sender: req.user._id,
              type: 'order',
              title: 'Product Not Approved ⚠️',
              message: `Your product "${product.name}" was not approved. Reason: ${rejectionNote}`,
              link: '/saloon-admin/products',
            });
          }
        }).catch(console.error);
      }
    }

    return sendSuccess(res, 200, 'Product rejected.', { product });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id (soft delete)
const deleteProduct = async (req, res, next) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    return sendSuccess(res, 200, 'Product deactivated.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getProduct,
  getMyProducts,
  getPendingProducts,
  createProduct,
  updateProduct,
  approveProduct,
  rejectProduct,
  deleteProduct,
};
