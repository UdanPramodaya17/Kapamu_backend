const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('❌ MONGO_URI is not defined in .env file');
    return;
  }

  const attemptConnect = async (attempt = 1) => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      
      // Re-sync review indexes to migrate from sparse index to partialFilterExpression
      try {
        const Review = require('../models/Review');
        await Review.syncIndexes();
      } catch (idxErr) {
        console.warn('⚠️ Review index sync:', idxErr.message);
      }
    } catch (error) {
      console.error(`❌ MongoDB Connection Error (attempt ${attempt}): ${error.message}`);
      console.log(`\n🔧 FIX REQUIRED:`);
      console.log(`   1. Go to https://cloud.mongodb.com`);
      console.log(`   2. Click "Network Access" → "+ ADD IP ADDRESS"`);
      console.log(`   3. Click "Allow Access from Anywhere" (0.0.0.0/0)`);
      console.log(`   4. Click Confirm and wait 30 seconds\n`);
      console.log(`⏳ Retrying in 5 seconds... (attempt ${attempt + 1})`);
      setTimeout(() => attemptConnect(attempt + 1), 5000);
    }
  };

  await attemptConnect();
};

module.exports = connectDB;
