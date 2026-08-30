const mongoose = require('mongoose');

const barberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    saloon: { type: mongoose.Schema.Types.ObjectId, ref: 'Saloon', required: true },
    specializations: [{ type: String }],
    bio: { type: String, trim: true },
    avatar: { type: String, default: '' },
    portfolioImages: [{ type: String }],
    workingHours: [
      {
        day: { type: Number, min: 0, max: 6 },
        startTime: { type: String, default: '09:00' },
        endTime: { type: String, default: '18:00' },
        isWorking: { type: Boolean, default: true },
      },
    ],
    leaveSchedule: [
      {
        date: { type: Date, required: true },
        startTime: { type: String },
        endTime: { type: String },
        isFullDay: { type: Boolean, default: true },
        reason: { type: String },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      },
    ],
    totalAppointments: { type: Number, default: 0 },
    monthlyStats: [
      {
        month: { type: Number, min: 1, max: 12 },
        year: { type: Number },
        totalAppointments: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Barber', barberSchema);
