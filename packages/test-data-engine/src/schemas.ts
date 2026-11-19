import { z } from 'zod';

/** Money is held in whole cents: no floating-point drift in totals, and it is what databases store. */
export const cents = z.number().int().nonnegative();

export const addressSchema = z.object({
  line1: z.string().min(1),
  city: z.string().min(1),
  postcode: z.string().min(1),
  country: z.string().length(2), // ISO 3166-1 alpha-2
});

export const customerSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  address: addressSchema,
  createdAt: z.iso.datetime(),
});

export const productSchema = z.object({
  sku: z.string().regex(/^[A-Z]{3}-\d{5}$/, 'SKU looks like ABC-12345'),
  name: z.string().min(1).max(120),
  category: z.enum(['books', 'electronics', 'garden', 'home', 'sports', 'toys']),
  priceCents: cents.min(1),
  stock: z.number().int().nonnegative(),
});

export const orderLineSchema = z.object({
  sku: productSchema.shape.sku,
  quantity: z.number().int().min(1).max(99),
  unitPriceCents: cents.min(1),
});

export const orderStatus = z.enum(['created', 'paid', 'shipped', 'cancelled']);

export const orderSchema = z
  .object({
    id: z.uuid(),
    customerId: z.uuid(),
    status: orderStatus,
    lines: z.array(orderLineSchema).min(1),
    totalCents: cents,
    currency: z.literal('USD'),
    createdAt: z.iso.datetime(),
  })
  // The one business rule every order must keep: the total is the sum of its lines.
  .refine((o) => o.totalCents === o.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0), {
    message: 'totalCents must equal the sum of quantity x unitPriceCents',
    path: ['totalCents'],
  });

export type Address = z.infer<typeof addressSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type Product = z.infer<typeof productSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type OrderStatus = z.infer<typeof orderStatus>;
export type Order = z.infer<typeof orderSchema>;
