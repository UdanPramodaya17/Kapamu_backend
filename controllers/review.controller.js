const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Saloon = require('../models/Saloon');
const Appointment = require('../models/Appointment');
const { sendSuccess, sendError } = require('../utils/response');

// POST /api/products/:productId/reviews
const createProductReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return sendError(res, 400, 'Rating must be between 1 and 5.');
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return sendError(res, 404, 'Product not found.');
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({ customer: req.user._id, product: productId });
    if (existingReview) {
      return sendError(res, 400, 'You have already reviewed this product.');
    }

    // Check if customer bought the product (Verified Purchase)
    const hasBought = await Order.findOne({
      customer: req.user._id,
      paymentStatus: 'paid',
      'items.product': productId,
    });

    // Create the review
    const review = await Review.create({
      customer: req.user._id,
      product: productId,
      rating: Number(rating),
      comment: comment || '',
      isVerified: !!hasBought,
    });

    // Recalculate average rating and total reviews for the product
    const reviews = await Review.find({ product: productId });
    const totalReviews = reviews.length;
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalReviews > 0 ? totalRating / totalReviews : 0;

    await Product.findByIdAndUpdate(productId, {
      ratings: Math.round(avgRating * 10) / 10,
      totalReviews,
    });

    // Populate customer info for the response
    const populatedReview = await review.populate('customer', 'name email avatar');

    // In-App Notification to Vendor Owner
    if (product.vendorId && product.vendorModel) {
      const { createNotification } = require('../utils/notify');
      const Seller = require('../models/Seller');
      const Saloon = require('../models/Saloon');

      const sendReviewNotification = (ownerId, link) => {
        createNotification({
          recipient: ownerId,
          sender: req.user._id,
          type: 'review',
          title: 'New Product Review ⭐',
          message: `${req.user.name || 'A customer'} left a ${rating}-star review for "${product.name}".`,
          link,
        });
      };

      if (product.vendorModel === 'Seller') {
        Seller.findById(product.vendorId).then(s => s?.owner && sendReviewNotification(s.owner, '/seller/products')).catch(console.error);
      } else if (product.vendorModel === 'Saloon') {
        Saloon.findById(product.vendorId).then(s => s?.owner && sendReviewNotification(s.owner, '/saloon-admin/products')).catch(console.error);
      }
    }

    return sendSuccess(res, 201, 'Review submitted successfully.', { review: populatedReview });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:productId/reviews
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ product: productId })
      .populate('customer', 'name email avatar')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Reviews fetched successfully.', { reviews });
  } catch (err) {
    next(err);
  }
};

// POST /api/appointments/:appointmentId/reviews
const createAppointmentReview = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return sendError(res, 400, 'Rating must be between 1 and 5.');
    }

    // Check if appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return sendError(res, 404, 'Appointment not found.');
    }

    // Verify ownership
    if (appointment.customer.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'You are not authorized to review this appointment.');
    }

    // Confirm it is completed
    if (appointment.status !== 'completed') {
      return sendError(res, 400, 'You can only review completed appointments.');
    }

    // Check if already reviewed
    if (appointment.isReviewed) {
      return sendError(res, 400, 'This appointment has already been reviewed.');
    }

    // Double check with Review collection to prevent index conflicts
    const existingReview = await Review.findOne({ appointment: appointmentId });
    if (existingReview) {
      return sendError(res, 400, 'This appointment has already been reviewed.');
    }

    // Create review
    const review = await Review.create({
      customer: req.user._id,
      saloon: appointment.saloon,
      barber: appointment.barber,
      appointment: appointmentId,
      rating: Number(rating),
      comment: comment || '',
      isVerified: true,
    });

    // Mark appointment as reviewed
    appointment.isReviewed = true;
    await appointment.save();

    // Recalculate average rating and total reviews for the Saloon
    const saloonReviews = await Review.find({ saloon: appointment.saloon });
    const totalReviews = saloonReviews.length;
    const totalRating = saloonReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalReviews > 0 ? totalRating / totalReviews : 0;

    await Saloon.findByIdAndUpdate(appointment.saloon, {
      rating: Math.round(avgRating * 10) / 10,
      totalReviews,
    });

    // In-App Notification to Saloon Owner
    const { createNotification } = require('../utils/notify');
    Saloon.findById(appointment.saloon).then(sal => {
      if (sal?.owner) {
        createNotification({
          recipient: sal.owner,
          sender: req.user._id,
          type: 'review',
          title: 'New Saloon Review ⭐',
          message: `${req.user.name || 'A client'} gave your salon a ${rating}-star rating.`,
          link: '/saloon-admin',
        });
      }
    }).catch(console.error);

    return sendSuccess(res, 201, 'Appointment review submitted successfully.', { review });
  } catch (err) {
    next(err);
  }
};

// GET /api/saloons/:saloonId/reviews
const getSaloonReviews = async (req, res, next) => {
  try {
    const { saloonId } = req.params;

    const reviews = await Review.find({ saloon: saloonId })
      .populate('customer', 'name email avatar')
      .populate({ path: 'barber', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Reviews fetched successfully.', { reviews });
  } catch (err) {
    next(err);
  }
};

// GET /api/reviews — SuperAdmin: get all reviews for moderation
const getAllReviews = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const query = {};

    if (type === 'product') {
      query.product = { $exists: true };
    } else if (type === 'saloon') {
      query.saloon = { $exists: true };
    }

    const reviews = await Review.find(query)
      .populate('customer', 'name email avatar')
      .populate('product', 'name')
      .populate('saloon', 'name')
      .populate({ path: 'barber', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Review.countDocuments(query);

    return sendSuccess(res, 200, 'All reviews fetched for moderation.', {
      reviews,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reviews/:reviewId — SuperAdmin: delete/moderate a review
const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) return sendError(res, 404, 'Review not found.');

    // If product review
    if (review.product) {
      const productId = review.product;
      await review.deleteOne();

      // Recalculate product ratings
      const reviews = await Review.find({ product: productId });
      const totalReviews = reviews.length;
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalReviews > 0 ? totalRating / totalReviews : 0;

      await Product.findByIdAndUpdate(productId, {
        ratings: Math.round(avgRating * 10) / 10,
        totalReviews,
      });
    }
    // If saloon review
    else if (review.saloon) {
      const saloonId = review.saloon;
      const appointmentId = review.appointment;
      await review.deleteOne();

      // Reset appointment reviewed status if reference exists
      if (appointmentId) {
        await Appointment.findByIdAndUpdate(appointmentId, { isReviewed: false });
      }

      // Recalculate saloon ratings
      const saloonReviews = await Review.find({ saloon: saloonId });
      const totalReviews = saloonReviews.length;
      const totalRating = saloonReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalReviews > 0 ? totalRating / totalReviews : 0;

      await Saloon.findByIdAndUpdate(saloonId, {
        rating: Math.round(avgRating * 10) / 10,
        totalReviews,
      });
    } else {
      await review.deleteOne();
    }

    return sendSuccess(res, 200, 'Review deleted and metrics recalculated.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/reviews/:reviewId/featured — SuperAdmin: toggle featured review
const toggleFeaturedReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) return sendError(res, 404, 'Review not found.');

    review.isFeatured = !review.isFeatured;
    await review.save();

    return sendSuccess(res, 200, `Review ${review.isFeatured ? 'pinned to' : 'removed from'} homepage featured reviews.`, { review });
  } catch (err) {
    next(err);
  }
};

// GET /api/reviews/featured — Public: get all featured reviews
const getFeaturedReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ isFeatured: true })
      .populate('customer', 'name email avatar')
      .populate('product', 'name')
      .populate('saloon', 'name')
      .sort({ updatedAt: -1 });

    return sendSuccess(res, 200, 'Featured reviews fetched successfully.', { reviews });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProductReview,
  getProductReviews,
  createAppointmentReview,
  getSaloonReviews,
  getAllReviews,
  deleteReview,
  toggleFeaturedReview,
  getFeaturedReviews,
};
