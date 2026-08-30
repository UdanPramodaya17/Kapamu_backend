const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    contactPhone: { type: String },
    contactEmail: { type: String },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountHolder: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      branchCode: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Seller', sellerSchema);
