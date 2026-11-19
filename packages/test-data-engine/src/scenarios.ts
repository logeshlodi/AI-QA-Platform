import { aCustomer, anOrder, aProduct } from './builders';
import { defaultSeed } from './random';
import type { Customer, Order, Product } from './schemas';

export interface Shop {
  seed: number;
  customers: Customer[];
  products: Product[];
  orders: Order[];
}

/**
 * A small, consistent shop: every order belongs to a customer in the list and uses products
 * from the catalogue at catalogue prices. Seed-stable, so a data-driven test that fails can be
 * replayed with AIQA_SEED=<seed>.
 */
export function shop(
  options: { customers?: number; products?: number; ordersPerCustomer?: number; seed?: number } = {},
): Shop {
  const seed = options.seed ?? defaultSeed();
  const products = aProduct(seed).buildMany(options.products ?? 8);
  const customers = aCustomer(seed + 1).buildMany(options.customers ?? 3);
  const orderBuilder = anOrder(seed + 2).from(products);
  const orders = customers.flatMap((customer) =>
    Array.from({ length: options.ordersPerCustomer ?? 2 }, () => orderBuilder.forCustomer(customer).build()),
  );
  return { seed, customers, products, orders };
}
