const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Static helper to get a setting
platformSettingsSchema.statics.getSetting = async function (key, defaultValue) {
  const doc = await this.findOne({ key });
  return doc ? doc.value : defaultValue;
};

// Static helper to set a setting
platformSettingsSchema.statics.setSetting = async function (key, value, userId) {
  return this.findOneAndUpdate(
    { key },
    { key, value, updatedBy: userId },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
