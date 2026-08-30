const Order = require('../models/Order');
const Product = require('../models/Product');
const Saloon = require('../models/Saloon');
const Seller = require('../models/Seller');
const VendorEarning = require('../models/VendorEarning');
const PlatformSettings = require('../models/PlatformSettings');
const { sendSuccess, sendError } = require('../utils/response');

// POST /api/orders
const createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod, notes } = req.body;

    // Get current commission rate
    const commissionRate = await PlatformSettings.getSetting('commissionRate', 10);

    // Validate products and calculate total
    let totalAmount = 0;
    const enrichedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive) {
        return sendError(res, 404, `Product not found: ${item.product}`);
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

      // Deduct inventory
      product.inventory.quantity -= item.quantity;
      await product.save();
    }

    const order = await Order.create({
      customer: req.user._id,
      items: enrichedItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      notes,
    });

    // Auto-create VendorEarning records for each item with a vendor
    for (let i = 0; i < enrichedItems.length; i++) {
      const item = enrichedItems[i];
      if (item.vendorId && item.vendorModel && item.vendorModel !== 'Global') {
        const itemTotal = item.price * item.quantity;
        const commissionAmount = Math.round((itemTotal * commissionRate) / 100 * 100) / 100;
        const vendorAmount = Math.round((itemTotal - commissionAmount) * 100) / 100;

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

    const populated = await order.populate('items.product', 'name images category');

    // In-App Notifications to Customer and Sellers/Saloons
    const { notifyOrderCreated } = require('../utils/notify');
    notifyOrderCreated(order).catch(console.error);

    return sendSuccess(res, 201, 'Order placed successfully.', { order: populated });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders - My orders (customer)
const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { customer: req.user._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('items.product', 'name images price')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Order.countDocuments(query);
    return sendSuccess(res, 200, 'Orders fetched.', {
      orders,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id
const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user._id })
      .populate('items.product', 'name images price category');
    if (!order) return sendError(res, 404, 'Order not found.');
    return sendSuccess(res, 200, 'Order fetched.', { order });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/vendor - Vendor sees their incoming orders
const getVendorOrders = async (req, res, next) => {
  try {
    let vendorId = null;
    if (req.user.role === 'saloon_admin') {
      const saloon = await Saloon.findOne({ owner: req.user._id });
      if (!saloon) return sendError(res, 404, 'No saloon found.');
      vendorId = saloon._id;
    } else if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ owner: req.user._id });
      if (!seller) return sendError(res, 404, 'No seller found.');
      vendorId = seller._id;
    } else {
      return sendError(res, 403, 'Not authorized as vendor.');
    }

    const { page = 1, limit = 20 } = req.query;
    const query = { 'items.vendorId': vendorId };

    const orders = await Order.find(query)
      .populate('customer', 'name email phone')
      .populate('items.product', 'name images price')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    // Filter out items that don't belong to this vendor
    const vendorOrders = orders.map(order => {
      const orderObj = order.toObject();
      orderObj.items = orderObj.items.filter(i => i.vendorId && i.vendorId.toString() === vendorId.toString());
      orderObj.vendorTotalAmount = orderObj.items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
      return orderObj;
    });

    return sendSuccess(res, 200, 'Vendor orders fetched.', {
      orders: vendorOrders,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/orders/:id/status - Admin/Vendor updates order status
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, ...(trackingNumber && { trackingNumber }) },
      { new: true }
    );
    if (!order) return sendError(res, 404, 'Order not found.');

    // In-App Notification to Customer
    if (order.customer) {
      const { createNotification } = require('../utils/notify');
      const titles = {
        processing: 'Order In Process ⏳',
        shipped: 'Order Shipped! 🚚',
        delivered: 'Order Delivered! 🎁',
        cancelled: 'Order Cancelled ❌',
      };
      const msgs = {
        processing: `Your order #${order._id.toString().slice(-6).toUpperCase()} is now being packed.`,
        shipped: `Your order #${order._id.toString().slice(-6).toUpperCase()} has shipped!${trackingNumber ? ` Tracking: ${trackingNumber}` : ''}`,
        delivered: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been delivered. Thank you!`,
        cancelled: `Your order #${order._id.toString().slice(-6).toUpperCase()} was cancelled.`,
      };

      if (titles[status]) {
        createNotification({
          recipient: order.customer,
          sender: req.user._id,
          type: 'order',
          title: titles[status],
          message: msgs[status],
          link: '/customer/orders',
        });
      }
    }

    return sendSuccess(res, 200, 'Order status updated.', { order });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/orders/:id - Cancel order (customer, only if pending)
const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
    if (!order) return sendError(res, 404, 'Order not found.');
    if (order.status !== 'pending') {
      return sendError(res, 400, 'Can only cancel pending orders.');
    }

    order.status = 'cancelled';
    order.cancelReason = req.body.cancelReason || 'Customer cancelled.';
    await order.save();

    // Restore inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 'inventory.quantity': item.quantity },
      });
    }

    // Cancel corresponding vendor earnings
    await VendorEarning.updateMany(
      { orderId: order._id, status: 'pending' },
      { status: 'cancelled' }
    );

    return sendSuccess(res, 200, 'Order cancelled.', { order });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getMyOrders, getOrder, getVendorOrders, updateOrderStatus, cancelOrder };
