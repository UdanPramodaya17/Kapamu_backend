const Seller = require('../models/Seller');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getSellerSetupPasswordEmail } = require('../utils/emailTemplates');
const { sendEmail } = require('../utils/email');

exports.createSeller = async (req, res) => {
  try {
    const { name, email, storeName, description, contactPhone, street, city, state, country, zipCode } = req.body;

    // 1. Check existing
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // 2. Create User with a random temp password (they will set it via email link)
    const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';
    const user = await User.create({
      name,
      email,
      password: tempPassword,
      phone: contactPhone,
      role: 'seller',
    });

    // 3. Create Seller Profile
    const seller = await Seller.create({
      owner: user._id,
      storeName,
      description,
      contactPhone,
      contactEmail: email,
      address: { street, city, state, country, zipCode },
    });

    // 4. Send setup password email
    try {
      const setupToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '48h' });
      const setupLink = `${process.env.CLIENT_URL}/set-password?token=${setupToken}`;

      await sendEmail({
        email,
        subject: 'KAPAMU Marketplace — Your Seller Account is Ready',
        html: getSellerSetupPasswordEmail(setupLink, name, storeName),
      });
    } catch (emailError) {
      console.error('Setup email failed:', emailError.message);
      // Don't fail the whole request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Seller account created. Setup password email sent.',
      data: { seller, user },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllSellers = async (req, res) => {
  try {
    const sellers = await Seller.find().populate('owner', 'name email phone avatar isActive');
    res.status(200).json({ success: true, data: { sellers } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMySellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findOne({ owner: req.user.id }).populate('owner', 'name email phone avatar');
    if (!seller) return res.status(404).json({ success: false, message: 'Seller profile not found' });

    res.status(200).json({ success: true, data: { seller } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMySellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findOneAndUpdate({ owner: req.user.id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller profile not found' });

    res.status(200).json({ success: true, data: { seller } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleSellerStatus = async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    seller.isActive = !seller.isActive;
    await seller.save();

    // Also toggle the user account
    await User.findByIdAndUpdate(seller.owner, { isActive: seller.isActive });

    res.status(200).json({ success: true, data: { seller } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
