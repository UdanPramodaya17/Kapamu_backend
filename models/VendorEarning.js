const mongoose = require('mongoose');

const vendorEarningSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, refPath: 'vendorModel', required: true },
    vendorModel: { type: String, enum: ['Seller', 'Saloon'], required: true },
    orderItemIndex: { type: Number, required: true }, // index of item in order.items[]
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    itemTotal: { type: Number, required: true, min: 0 }, // price × quantity (what customer paid)
    commissionRate: { type: Number, required: true, min: 0, max: 100 }, // e.g. 10 means 10%
    commissionAmount: { type: Number, required: true, min: 0 }, // platform's cut
    vendorAmount: { type: Number, required: true, min: 0 }, // what vendor receives (itemTotal - commission)
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    paidAt: { type: Date },
    paidReference: { type: String, default: '' }, // bank transfer reference number
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // SuperAdmin who marked as paid
  },
  { timestamps: true }
);

// Indexes for fast lookups
vendorEarningSchema.index({ vendorId: 1, status: 1 });
vendorEarningSchema.index({ orderId: 1 });
vendorEarningSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('VendorEarning', vendorEarningSchema);
