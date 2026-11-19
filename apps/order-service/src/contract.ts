import { z } from 'zod';

/**
 * What the service accepts on orders.placed. Kept here, not imported from the test packages:
 * a service must not depend on its tests. The data suite checks the two agree.
 */
export const placedOrder = z
  .object({
    id: z.uuid(),
    customerId: z.uuid(),
    currency: z.literal('USD'),
    totalCents: z.number().int().nonnegative(),
    lines: z
      .array(
        z.object({
          sku: z.string().min(1),
          quantity: z.number().int().min(1).max(99),
          unitPriceCents: z.number().int().min(1),
        }),
      )
      .min(1),
  })
  .refine((o) => o.totalCents === o.lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0), {
    message: 'totalCents does not match the lines',
  });

export type PlacedOrder = z.infer<typeof placedOrder>;

/** What `PUT /products/:sku` accepts: creates the product or replaces its name, price and stock. */
export const productUpsert = z.object({
  name: z.string().min(1),
  priceCents: z.number().int().min(1),
  stock: z.number().int().nonnegative(),
});
