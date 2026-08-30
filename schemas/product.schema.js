const { z } = require('zod');

const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  salePrice: z.number().positive().optional(),
  category: z
    .enum(['shampoo', 'conditioner', 'styling', 'tools', 'skincare', 'beard', 'accessories', 'other'])
    .default('other'),
  inventory: z
    .object({
      quantity: z.number().int().min(0).default(0),
      lowStockThreshold: z.number().int().min(0).default(5),
    })
    .optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        product: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  shippingAddress: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    zipCode: z.string().min(1),
  }),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'wallet']).default('cash'),
  notes: z.string().optional(),
});

module.exports = { createProductSchema, createOrderSchema };
