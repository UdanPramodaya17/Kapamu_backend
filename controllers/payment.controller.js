const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const VendorEarning = require('../models/VendorEarning');
const PlatformSettings = require('../models/PlatformSettings');
const { sendSuccess, sendError } = require('../utils/response');

const getMerchantId = () => (process.env.PAYHERE_MERCHANT_ID || '1235098').replace(/['"]/g, '').trim();
const getMerchantSecret = () => (process.env.PAYHERE_MERCHANT_SECRET || 'MTY2MzMwNzczNDc5Mjk5Nzg3MzIzMTY5MjQ2MzE3NjkwNzcyMTc=').replace(/['"]/g, '').trim();
const getMode = () => (process.env.PAYHERE_MODE || 'sandbox').trim().toLowerCase();

const getCheckoutUrl = () =>
  getMode() === 'production'
    ? 'https://www.payhere.lk/pay/checkout'
    : 'https://sandbox.payhere.lk/pay/checkout';

/**
 * Generate PayHere hash
 * hash = MD5(merchant_id + order_id + amount_formatted + currency + MD5(secret).toUpperCase()).toUpperCase()
 */
function generateHash(orderId, amount, currency = 'LKR') {
  const secret = getMerchantSecret();
  const merchantId = getMerchantId();

  const hashedSecret = crypto
    .createHash('md5')
    .update(secret)
    .digest('hex')
    .toUpperCase();

  const formattedAmount = parseFloat(amount).toFixed(2);
  const raw = `${merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
  const hash = crypto.createHash('md5').update(raw).digest('hex').toUpperCase();

  return hash;
}

/**
 * Verify PayHere notification MD5 signature
 * md5sig = MD5(merchant_id + order_id + amount + currency + status + MD5(secret).toUpperCase()).toUpperCase()
 */
function verifyNotifyHash(orderId, amount, currency, statusCode, receivedMd5) {
  const secret = getMerchantSecret();
  const merchantId = getMerchantId();

  const hashedSecret = crypto
    .createHash('md5')
    .update(secret)
    .digest('hex')
    .toUpperCase();

  const formattedAmount = parseFloat(amount).toFixed(2);
  const raw = `${merchantId}${orderId}${formattedAmount}${currency}${statusCode}${hashedSecret}`;
  const expected = crypto.createHash('md5').update(raw).digest('hex').toUpperCase();
  return expected === receivedMd5?.toUpperCase();
}

// POST /api/payment/initiate
// Called from frontend with cart items + shipping before redirecting to PayHere
const initiatePayment = async (req, res, next) => {
  try {
    const { items, shippingAddress, notes } = req.body;

    // Validate items and calculate total (same as createOrder)
    let totalAmount = 0;
    const enrichedItems = [];
    const commissionRate = await PlatformSettings.getSetting('commissionRate', 10);

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive || product.status !== 'approved') {
        return sendError(res, 404, `Product not available: ${item.product}`);
      }
      if (product.inventory.quantity < item.quantity) {
        return sendError(res, 400, `Insufficient stock for: ${product.name}`);
      }
      const price = product.salePrice || product.price;
      totalAmount += price * item.quantity;
      enrichedItems.push({
        product: product._id,
        quantity: item.quantity,
        price,
        name: product.name,
        vendorId: product.vendorId,
        vendorModel: product.vendorModel,
      });
    }

    // Create a pending order in DB (payhere will confirm later via notify)
    const payhereOrderId = `PH-${Date.now()}-${req.user._id.toString().slice(-5)}`;

    const order = await Order.create({
      customer: req.user._id,
      items: enrichedItems,
      totalAmount,
      shippingAddress,
      paymentMethod: 'payhere',
      paymentStatus: 'unpaid',
      payhereOrderId,
      notes,
    });

    // Deduct inventory immediately (restore if payment fails via notify)
    for (const item of enrichedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 'inventory.quantity': -item.quantity },
      });
    }

    // Generate PayHere hash
    const hash = generateHash(payhereOrderId, totalAmount);

    const clientUrl = (process.env.CLIENT_URL || req.headers.origin || 'http://localhost:5173').replace(/\/$/, '');
    const serverUrl = (process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    // Build PayHere params to send to frontend with fallback defaults
    const paymentParams = {
      merchant_id: getMerchantId(),
      return_url: `${clientUrl}/payment/return`,
      cancel_url: `${clientUrl}/payment/cancel`,
      notify_url: `${serverUrl}/api/payment/notify`,
      order_id: payhereOrderId,
      items: enrichedItems.map((i) => i.name).join(', '),
      currency: 'LKR',
      amount: parseFloat(totalAmount).toFixed(2),
      first_name: shippingAddress.name?.split(' ')[0] || 'Customer',
      last_name: shippingAddress.name?.split(' ').slice(1).join(' ') || 'User',
      email: req.user.email || 'customer@stylehub.com',
      phone: shippingAddress.phone || '0771234567',
      address: shippingAddress.street || 'Colombo Rd',
      city: shippingAddress.city || 'Colombo',
      country: 'Sri Lanka',
      hash,
      checkout_url: getCheckoutUrl(),
    };

    return sendSuccess(res, 200, 'Payment initiated.', {
      orderId: order._id,
      payhereOrderId,
      paymentParams,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/payment/notify  — PayHere server-to-server callback (NOT authenticated)
// PayHere calls this to confirm payment
const handleNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      payment_id,
    } = req.body;

    // 1. Verify merchant
    if (merchant_id !== MERCHANT_ID) {
      console.warn('[PayHere] Merchant ID mismatch:', merchant_id);
      return res.sendStatus(400);
    }

    // 2. Verify hash
    const valid = verifyNotifyHash(order_id, payhere_amount, payhere_currency, status_code, md5sig);
    if (!valid) {
      console.warn('[PayHere] Hash verification failed for order:', order_id);
      return res.sendStatus(400);
    }

    // 3. Find order
    const order = await Order.findOne({ payhereOrderId: order_id });
    if (!order) {
      console.warn('[PayHere] Order not found:', order_id);
      return res.sendStatus(404);
    }

    // 4. Handle status codes
    // 2 = Success, 0 = Pending, -1 = Cancelled, -2 = Failed, -3 = Chargedback
    const statusInt = parseInt(status_code);

    if (statusInt === 2) {
      // Payment SUCCESS
      order.paymentStatus = 'paid';
      order.payherePaymentId = payment_id || '';
      await order.save();

      // Create VendorEarning records
      const commissionRate = await PlatformSettings.getSetting('commissionRate', 10);
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        if (item.vendorId && item.vendorModel && item.vendorModel !== 'Global') {
          const itemTotal = item.price * item.quantity;
          const commissionAmount = Math.round((itemTotal * commissionRate) / 100 * 100) / 100;
          const vendorAmount = Math.round((itemTotal - commissionAmount) * 100) / 100;

          // Avoid duplicate earnings if notify fires twice
          const existing = await VendorEarning.findOne({ orderId: order._id, orderItemIndex: i });
          if (!existing) {
            await VendorEarning.create({
              orderId: order._id,
              vendorId: item.vendorId,
              vendorModel: item.vendorModel,
              orderItemIndex: i,
              productId: item.product,
              productName: item.name,
              quantity: item.quantity,
              itemTotal,
              commissionRate,
              commissionAmount,
              vendorAmount,
              status: 'pending',
            });
          }
        }
      }

      // In-App Notifications on successful payment
      const { notifyOrderCreated } = require('../utils/notify');
      notifyOrderCreated(order).catch(console.error);

      console.log(`[PayHere] ✅ Payment SUCCESS for order ${order_id}`);
    } else if (statusInt === -1 || statusInt === -2) {
      // Payment FAILED or CANCELLED — restore inventory
      order.paymentStatus = 'failed';
      await order.save();

      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 'inventory.quantity': item.quantity },
        });
      }
      console.log(`[PayHere] ❌ Payment failed/cancelled for order ${order_id}, status: ${status_code}`);
    } else if (statusInt === 0) {
      console.log(`[PayHere] ⏳ Payment pending for order ${order_id}`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[PayHere] Notify error:', err);
    return res.sendStatus(500);
  }
};

// GET /api/payment/verify/:payhereOrderId — Frontend polls this after return
const verifyPayment = async (req, res, next) => {
  try {
    const { payhereOrderId } = req.params;
    const order = await Order.findOne({
      payhereOrderId,
      customer: req.user._id,
    }).populate('items.product', 'name images');

    if (!order) return sendError(res, 404, 'Order not found.');

    // Development & Sandbox Confirmation:
    // When running in sandbox mode or locally, PayHere IPN notify webhooks can be delayed or blocked on free cloud servers.
    // If PAYHERE_MODE is 'sandbox' or NODE_ENV is 'development', confirm the payment upon successful return.
    const isSandboxMode = process.env.PAYHERE_MODE === 'sandbox' || process.env.NODE_ENV === 'development';
    if (isSandboxMode && order.paymentStatus === 'unpaid') {
      console.log(`[PayHere Sandbox/Dev] Confirming payment for order: ${payhereOrderId}`);
      
      order.paymentStatus = 'paid';
      order.payherePaymentId = `SANDBOX-${Date.now()}`;
      await order.save();

      // Create VendorEarning records
      const commissionRate = await PlatformSettings.getSetting('commissionRate', 10);
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        if (item.vendorId && item.vendorModel && item.vendorModel !== 'Global') {
          const itemTotal = item.price * item.quantity;
          const commissionAmount = Math.round((itemTotal * commissionRate) / 100 * 100) / 100;
          const vendorAmount = Math.round((itemTotal - commissionAmount) * 100) / 100;

          const existing = await VendorEarning.findOne({ orderId: order._id, orderItemIndex: i });
          if (!existing) {
            await VendorEarning.create({
              orderId: order._id,
              vendorId: item.vendorId,
              vendorModel: item.vendorModel,
              orderItemIndex: i,
              productId: item.product,
              productName: item.name,
              quantity: item.quantity,
              itemTotal,
              commissionRate,
              commissionAmount,
              vendorAmount,
              status: 'pending',
            });
          }
        }
      }

      // In-App Notifications on auto-confirmed development payment
      const { notifyOrderCreated } = require('../utils/notify');
      notifyOrderCreated(order).catch(console.error);
    }

    return sendSuccess(res, 200, 'Payment status fetched.', {
      orderId: order._id,
      payhereOrderId: order.payhereOrderId,
      paymentStatus: order.paymentStatus,
      status: order.paymentStatus === 'paid' ? 'success' : 'failed',
      totalAmount: order.totalAmount,
      order,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { initiatePayment, handleNotify, verifyPayment };
