const mongoose = require('mongoose');

const saloonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coverImage: { type: String, default: '' },
    images: [{ type: String }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    operatingHours: [
      {
        day: { type: Number, min: 0, max: 6 }, // 0=Sunday
        openTime: { type: String, default: '09:00' },
        closeTime: { type: String, default: '21:00' },
        isClosed: { type: Boolean, default: false },
      },
    ],
    holidays: [
      {
        date: { type: Date },
        reason: { type: String },
      },
    ],
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isRecommended: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    phone: { 
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^(?:\+94|94|0)\d{9}$/.test(v);
        },
        message: props => `${props.value} is not a valid Sri Lankan phone number!`
      }
    },
    email: { type: String },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountHolder: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      branchCode: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

saloonSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Saloon', saloonSchema);
