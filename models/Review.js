const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    saloon: { type: mongoose.Schema.Types.ObjectId, ref: 'Saloon' },
    barber: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    images: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes to prevent duplicate reviews
reviewSchema.index(
  { customer: 1, appointment: 1 },
  { 
    unique: true, 
    partialFilterExpression: { appointment: { $exists: true, $type: 'objectId' } } 
  }
);
reviewSchema.index(
  { customer: 1, product: 1 },
  { 
    unique: true, 
    partialFilterExpression: { product: { $exists: true, $type: 'objectId' } } 
  }
);

module.exports = mongoose.model('Review', reviewSchema);
