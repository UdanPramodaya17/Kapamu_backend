const { z } = require('zod');

const createAppointmentSchema = z.object({
  saloon: z.string().min(1, 'Saloon ID is required.'),
  barber: z.string().min(1, 'Barber ID is required.'),
  service: z.string().min(1, 'Service ID is required.'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date format.'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format.'),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'wallet']).default('cash'),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']),
  cancelReason: z.string().optional(),
});

module.exports = { createAppointmentSchema, updateStatusSchema };
