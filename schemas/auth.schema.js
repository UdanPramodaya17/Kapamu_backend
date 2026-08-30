const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  phone: z.string().refine((val) => !val || /^(?:\+94|94|0)7\d{8}$/.test(val), {
    message: 'Invalid Sri Lankan mobile number. Must start with 07, +947 or 947.',
  }).optional(),
  role: z.enum(['customer', 'saloon_admin', 'barber']).default('customer'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

module.exports = { registerSchema, loginSchema, refreshSchema };
