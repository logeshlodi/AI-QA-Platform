import type { NewOrder } from './storefront-client';

/**
 * The example data the contracts are written with. The consumer tests put these values in the pact;
 * the provider's state handlers create exactly these records before the pact is replayed against the
 * real service. Fixed ids keep the pact files stable from run to run.
 */
export const PACT_SKU = 'PACT-SKU-1';
export const PACT_PRODUCT = { sku: PACT_SKU, name: 'Contract test mug', priceCents: 1250, stock: 1000 };

export const CONFIRMED_ORDER_ID = '7d1c5a8e-3f2b-4c6d-9e8a-1b2c3d4e5f60';
export const MISSING_ORDER_ID = '00000000-0000-4000-8000-000000000404';

/** A valid order for the contract product: two mugs. */
export const exampleOrder = (id: string): NewOrder => ({
  id,
  customerId: 'c0ffee00-1234-4abc-8def-0123456789ab',
  currency: 'USD',
  totalCents: 2 * PACT_PRODUCT.priceCents,
  lines: [{ sku: PACT_SKU, quantity: 2, unitPriceCents: PACT_PRODUCT.priceCents }],
});

export const PLACED_ORDER_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';

export const STATES = {
  productInStock: `product ${PACT_SKU} is in stock`,
  orderConfirmed: 'an order is confirmed',
  noSuchOrder: 'no order has the id asked for',
  orderWasConfirmed: 'an order was confirmed',
  orderWasRejected: 'an order was rejected for lack of stock',
} as const;
