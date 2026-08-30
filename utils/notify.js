const Notification = require('../models/Notification');

/**
 * Dispatch an in-app notification to a user.
 * Safe & asynchronous - will not break parent transactions if an error occurs.
 */
const createNotification = async ({ recipient, sender = null, type = 'system', title, message, link = null, metadata = {} }) => {
  try {
    if (!recipient) return null;

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      title,
      message,
      link,
      metadata,
    });

    return notification;
  } catch (error) {
    console.error('Failed to create in-app notification:', error.message);
    return null;
  }
};

/**
 * Dispatch notifications when an order is created / confirmed.
 * Notifies customer and distinct vendors (Sellers & Saloons).
 */
const notifyOrderCreated = async (order) => {
  try {
    if (!order) return;
    const Seller = require('../models/Seller');
    const Saloon = require('../models/Saloon');

    const orderShortId = order._id.toString().slice(-6).toUpperCase();

    // 1. Notify Customer
    if (order.customer) {
      await createNotification({
        recipient: order.customer,
        type: 'order',
        title: 'Order Placed Successfully! 🛍️',
        message: `Your order #${orderShortId} for LKR ${Number(order.totalAmount || 0).toLocaleString()} has been placed.`,
        link: '/customer/orders',
      });
    }

    // 2. Group items by vendor to notify each vendor only once per order
    const sellerIds = new Set();
    const saloonIds = new Set();

    for (const item of (order.items || [])) {
      if (item.vendorId) {
        if (item.vendorModel === 'Seller') {
          sellerIds.add(item.vendorId.toString());
        } else if (item.vendorModel === 'Saloon') {
          saloonIds.add(item.vendorId.toString());
        }
      }
    }

    // Notify Sellers
    for (const sellerId of sellerIds) {
      try {
        const seller = await Seller.findById(sellerId);
        if (seller?.owner) {
          await createNotification({
            recipient: seller.owner,
            sender: order.customer || null,
            type: 'order',
            title: 'New Store Order Received 📦',
            message: `You have received a new customer order #${orderShortId}.`,
            link: '/seller/orders',
          });
        }
      } catch (err) {
        console.error('Error notifying seller:', err.message);
      }
    }

    // Notify Saloons
    for (const saloonId of saloonIds) {
      try {
        const saloon = await Saloon.findById(saloonId);
        if (saloon?.owner) {
          await createNotification({
            recipient: saloon.owner,
            sender: order.customer || null,
            type: 'order',
            title: 'New Product Order Received 📦',
            message: `You have received a new product order #${orderShortId}.`,
            link: '/saloon-admin/orders',
          });
        }
      } catch (err) {
        console.error('Error notifying saloon:', err.message);
      }
    }
  } catch (error) {
    console.error('Failed in notifyOrderCreated:', error.message);
  }
};

/**
 * Dispatch notifications to multiple recipients at once.
 */
const createBatchNotifications = async (notificationsList) => {
  try {
    if (!Array.isArray(notificationsList) || notificationsList.length === 0) return [];
    return await Notification.insertMany(notificationsList);
  } catch (error) {
    console.error('Failed to batch create in-app notifications:', error.message);
    return [];
  }
};

module.exports = {
  createNotification,
  createBatchNotifications,
  notifyOrderCreated,
};
