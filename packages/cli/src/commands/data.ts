import { aCustomer, anOrder, aProduct, shop } from '@aiqa/test-data-engine';

export const ENTITIES = ['customer', 'product', 'order', 'shop'] as const;
export type Entity = (typeof ENTITIES)[number];

/** Test data as JSON, for pasting into a request, a fixture file or a database. */
export function makeData(entity: Entity, count: number, seed: number): unknown {
  switch (entity) {
    case 'customer':
      return aCustomer(seed).buildMany(count);
    case 'product':
      return aProduct(seed).buildMany(count);
    case 'order':
      return anOrder(seed).buildMany(count);
    case 'shop':
      return shop({ seed, customers: count });
  }
}
