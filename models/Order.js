const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true }, // price at time of order
        name: { type: String }, // snapshot of product name
        vendorId: { type: mongoose.Schema.Types.ObjectId, refPath: 'items.vendorModel' },
        vendorModel: { type: String, enum: ['Saloon', 'Seller', 'Global'] },
        itemStatus: { 
          type: String, 
          enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
          default: 'pending'
        },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: {
      name: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded', 'failed'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet', 'payhere'],
      default: 'cash',
    },
    // PayHere specific fields
    payhereOrderId: { type: String, unique: true, sparse: true }, // unique ref sent to payhere
    payherePaymentId: { type: String, default: '' },              // payhere transaction ID
    trackingNumber: { type: String },
    notes: { type: String },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);

