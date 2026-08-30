const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, refPath: 'vendorModel', default: null }, // null = global/super-admin
    vendorModel: { type: String, enum: ['Saloon', 'Seller'], default: 'Saloon' },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0 },
    category: {
      type: String,
      enum: ['shampoo', 'conditioner', 'styling', 'tools', 'skincare', 'beard', 'accessories', 'other'],
      default: 'other',
    },
    images: [{ type: String }],
    inventory: {
      quantity: { type: Number, default: 0, min: 0 },
      lowStockThreshold: { type: Number, default: 5 },
    },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    // Approval workflow: pending → approved (goes live) or rejected
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    ratings: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.virtual('isOnSale').get(function () {
  return this.salePrice && this.salePrice < this.price;
});

productSchema.virtual('isLowStock').get(function () {
  return this.inventory.quantity <= this.inventory.lowStockThreshold;
});

module.exports = mongoose.model('Product', productSchema);
