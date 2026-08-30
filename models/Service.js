const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    saloon: { type: mongoose.Schema.Types.ObjectId, ref: 'Saloon', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 5 }, // in minutes
    category: {
      type: String,
      enum: ['haircut', 'shave', 'beard', 'color', 'treatment', 'massage', 'facial', 'other'],
      default: 'other',
    },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
