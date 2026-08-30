require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Saloon = require('../models/Saloon');
const Barber = require('../models/Barber');
const Service = require('../models/Service');
const Product = require('../models/Product');

const connectDB = require('../config/db');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...\n');

  // Clear
  await Promise.all([
    User.deleteMany({}),
    Saloon.deleteMany({}),
    Barber.deleteMany({}),
    Service.deleteMany({}),
    Product.deleteMany({}),
  ]);

  // Users
  const [superAdmin, saloonAdmin, barberUser, customer] = await User.create([
    { name: 'Super Admin', email: 'admin@stylehub.com', password: 'password123', role: 'super_admin', isVerified: true, isActive: true },
    { name: 'Rahul Sharma', email: 'salon@stylehub.com', password: 'password123', role: 'saloon_admin', isVerified: true, isActive: true },
    { name: 'Karan Singh', email: 'barber@stylehub.com', password: 'password123', role: 'barber', isVerified: true, isActive: true },
    { name: 'Priya Mehta', email: 'customer@stylehub.com', password: 'password123', role: 'customer', isVerified: true, isActive: true },
  ]);
  console.log('✅ Users created');

  console.log('\n🎉 Seeding complete!\n');
  console.log('Demo Accounts:');
  console.log('  Super Admin:  admin@stylehub.com / password123');
  console.log('  Salon Admin:  salon@stylehub.com / password123');
  console.log('  Barber:       barber@stylehub.com / password123');
  console.log('  Customer:     customer@stylehub.com / password123');

  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
