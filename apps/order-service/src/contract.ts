import { z } from 'zod';

/**
 * The largest value the money and stock columns hold (Postgres INTEGER). Every amount is capped here:
 * a larger one passed validation and then failed in the database, which on the Kafka path stopped the
 * service on that message for good (found by the ZAP scan, 20 Nov 2026).
 */
export const MAX_DB_INTEGER = 2_147_483_647;
const amount = (min: number) => z.number().int().min(min).max(MAX_DB_INTEGER);

/** A SKU: the same rule as the /products/{sku} path. */
export const SKU_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
const sku = z
  .string()
  .regex(new RegExp(SKU_PATTERN), 'sku must be 1-64 letters, digits, dots, dashes or underscores');

/**
 * Text Postgres can store and people can read: no control characters. A NUL (0x00) passed validation
 * and failed in the database ("invalid byte sequence for encoding UTF8"): a 500, found by the ZAP scan.
 */
const printable = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]+$/, 'must not contain control characters');

/**
 * What the service accepts on orders.placed. Kept here, not imported from the test packages:
 * a service must not depend on its tests. The data suite checks the two agree.
 */
export const placedOrder = z
  .object({
    id: z.uuid(),
    customerId: z.uuid(),
    currency: z.literal('USD'),
    totalCents: amount(0),
    lines: z
      .array(
        z.object({
          sku,
          quantity: z.number().int().min(1).max(99),
          unitPriceCents: amount(1),
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
  name: printable(200),
  priceCents: amount(1),
  stock: amount(0),
});
