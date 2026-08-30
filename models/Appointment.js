const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    saloon: { type: mongoose.Schema.Types.ObjectId, ref: 'Saloon', required: true },
    barber: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    date: { type: Date, required: true }, // day only
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }, // HH:mm
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
      default: 'pending',
    },
    notes: { type: String, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet'],
      default: 'cash',
    },
    cancelReason: { type: String },
    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

appointmentSchema.index({ barber: 1, date: 1 });
appointmentSchema.index({ customer: 1, date: -1 });
appointmentSchema.index({ saloon: 1, date: -1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
