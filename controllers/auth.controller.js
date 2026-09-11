const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const {
  getVerificationOtpEmail,
  getSaloonSetupPasswordEmail,
  getPasswordResetEmail,
} = require('../utils/emailTemplates');
const { sendEmail } = require('../utils/email');

// Google Auth Client Setup
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Temporary memory store for OTPs (For production, use Redis or a Mongoose model)
const otpStore = new Map();

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    const role = 'customer'; // Force to customer, prevent public arbitrary role registration

    const existing = await User.findOne({ email });
    if (existing) return sendError(res, 409, 'Email already registered.');

    const user = await User.create({ name, email, password, phone, role });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return sendSuccess(res, 201, 'Registration successful.', {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required.');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) return sendError(res, 401, 'Invalid email or password.');

    if (!user.isActive) {
      return sendError(res, 403, 'Account is deactivated. Contact admin.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return sendError(res, 401, 'Invalid email or password.');

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return sendSuccess(res, 200, 'Login successful.', {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 400, 'Refresh token required.');

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return sendError(res, 401, 'Invalid refresh token.');
    }

    const newAccessToken = generateAccessToken(user);
    return sendSuccess(res, 200, 'Token refreshed.', { accessToken: newAccessToken });
  } catch (err) {
    return sendError(res, 401, 'Invalid or expired refresh token.');
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  return sendSuccess(res, 200, 'Logged out successfully.');
};

// GET /api/auth/me
const getMe = async (req, res) => {
  return sendSuccess(res, 200, 'Profile fetched.', { user: req.user });
};

// POST /api/auth/google
const googleAuth = async (req, res, next) => {
  try {
    const { token } = req.body;
    let name, email, picture;

    // First try token as an access_token by fetching userinfo from Google API
    try {
      const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (googleRes.ok) {
        const userInfo = await googleRes.json();
        name = userInfo.name;
        email = userInfo.email;
        picture = userInfo.picture;
      }
    } catch (fetchErr) {
      console.log('Access token fetch failed, falling back to ID token verify');
    }

    // Fallback: Verify as an ID token via Google Client if access_token didn't resolve
    if (!email) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        name = payload.name;
        email = payload.email;
        picture = payload.picture;
      } catch (verifyErr) {
        return sendError(res, 400, 'Invalid Google token.');
      }
    }

    if (!email) {
      return sendError(res, 400, 'Unable to get email from Google token.');
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        avatar: picture,
        role: 'customer',
        googleId: token.substring(0, 30),
      });
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account is deactivated. Contact admin.');
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return sendSuccess(res, 200, 'Google auth successful.', {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/send-verification
// POST /api/auth/send-verification
const sendVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 400, 'Email is required.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6 digit OTP

    otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000 }); // Save with 10 mins expiry

    await sendEmail({
      email,
      subject: 'KAPAMU — Your Security Verification Code',
      html: getVerificationOtpEmail(otp),
    });

    console.log(`[OTP] Verification code sent successfully to ${email}`);
    return sendSuccess(res, 200, `Verification code sent to ${email}`);
  } catch (err) {
    console.error('[OTP Error] Failed to send verification code:', err.message || err);
    next(err);
  }
};

const verifyCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const record = otpStore.get(email);

    if (!record) return sendError(res, 400, 'No verification code found or already verified.');
    if (Date.now() > record.expires) {
      otpStore.delete(email);
      return sendError(res, 400, 'Verification code has expired.');
    }
    if (record.otp !== code) return sendError(res, 400, 'Invalid verification code.');

    otpStore.delete(email); // Remove code after successful verification
    return sendSuccess(res, 200, 'Code verified successfully');
  } catch (err) {
    next(err);
  }
};

const sendSetupPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return sendError(res, 404, 'User not found.');

    const setupToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const setupLink = `${process.env.CLIENT_URL}/set-password?token=${setupToken}`;

    await sendEmail({
      email,
      subject: 'KAPAMU — Set Up Your Saloon Admin Account Password',
      html: getSaloonSetupPasswordEmail(setupLink, user.name),
    });

    return sendSuccess(res, 200, 'Setup password email sent.');
  } catch (err) {
    console.error('[Setup Password Error]:', err.message || err);
    next(err);
  }
};

const setNewPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ email: decoded.email });
    if (!user) return sendError(res, 404, 'User not found.');

    user.password = newPassword;
    await user.save();

    return sendSuccess(res, 200, 'Password set successfully.');
  } catch (err) {
    return sendError(res, 400, 'Invalid or expired setup token.');
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    // If this user is a barber, also keep Barber.avatar in sync
    if (user && user.role === 'barber' && avatar !== undefined) {
      const Barber = require('../models/Barber');
      await Barber.findOneAndUpdate({ user: user._id }, { avatar });
    }

    return sendSuccess(res, 200, 'Profile updated successfully.', { user });
  } catch (err) {
    next(err);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return sendError(res, 400, 'Incorrect current password.');

    user.password = newPassword;
    await user.save();

    return sendSuccess(res, 200, 'Password updated successfully.');
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return sendError(res, 404, 'User not found.');

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      email,
      subject: 'KAPAMU — Password Reset Request',
      html: getPasswordResetEmail(resetLink),
    });

    return sendSuccess(res, 200, 'Password reset link sent to your email.');
  } catch (err) {
    console.error('[Forgot Password Error]:', err.message || err);
    next(err);
  }
};

module.exports = { register, login, refresh, logout, getMe, googleAuth, sendVerificationCode, verifyCode, sendSetupPassword, setNewPassword, updateProfile, updatePassword, forgotPassword };

