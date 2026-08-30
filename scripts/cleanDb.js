require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Saloon = require('../models/Saloon');
const Barber = require('../models/Barber');
const Service = require('../models/Service');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Appointment = require('../models/Appointment');

const clean = async () => {
  await connectDB();
  console.log('🧹 Starting database cleanup of dummy saloons and products...\n');

  // Find the saloon "Royal Cuts Delhi"
  const dummySaloon = await Saloon.findOne({ name: 'Royal Cuts Delhi' });
  if (dummySaloon) {
    console.log(`Found dummy saloon "${dummySaloon.name}" (ID: ${dummySaloon._id})`);
    
    // Delete associated barbers, services, appointments, reviews
    const barberRes = await Barber.deleteMany({ saloon: dummySaloon._id });
    console.log(`Deleted ${barberRes.deletedCount} associated barbers`);

    const serviceRes = await Service.deleteMany({ saloon: dummySaloon._id });
    console.log(`Deleted ${serviceRes.deletedCount} associated services`);

    const aptRes = await Appointment.deleteMany({ saloon: dummySaloon._id });
    console.log(`Deleted ${aptRes.deletedCount} associated appointments`);

    const reviewRes = await Review.deleteMany({ saloon: dummySaloon._id });
    console.log(`Deleted ${reviewRes.deletedCount} associated reviews`);

    // Delete the saloon itself
    await Saloon.deleteOne({ _id: dummySaloon._id });
    console.log('Deleted dummy saloon successfully');
  } else {
    console.log('No dummy saloon "Royal Cuts Delhi" found.');
  }

  // Delete dummy products
  const dummyProductNames = [
    'Premium Beard Oil',
    'Matte Clay Pomade',
    'Professional Hair Trimmer',
    'Argan Oil Shampoo',
    'Deep Conditioning Mask'
  ];

  const productRes = await Product.deleteMany({ name: { $in: dummyProductNames } });
  console.log(`Deleted ${productRes.deletedCount} dummy products matching the seed names`);

  console.log('\n✨ Database cleanup complete!\n');
  process.exit(0);
};

clean().catch(err => {
  console.error('❌ Cleanup error:', err);
  process.exit(1);
});
