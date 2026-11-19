import { describe, expect, it } from 'vitest';
import {
  aCustomer,
  anOrder,
  aProduct,
  customerSchema,
  orderSchema,
  OrderBuilder,
  productSchema,
  shop,
} from '../src';

describe('builders', () => {
  it('build valid records', () => {
    expect(customerSchema.safeParse(aCustomer().build()).success).toBe(true);
    expect(productSchema.safeParse(aProduct().build()).success).toBe(true);
    expect(orderSchema.safeParse(anOrder().build()).success).toBe(true);
  });

  it('give the same data for the same seed, and different data for another', () => {
    expect(aCustomer(42).build()).toEqual(aCustomer(42).build());
    expect(anOrder(42).buildMany(3)).toEqual(anOrder(42).buildMany(3));
    expect(aCustomer(42).build().id).not.toBe(aCustomer(43).build().id);
  });

  it('let a test pin only the fields it cares about', () => {
    const customer = aCustomer(1).with({ firstName: 'Asha' }).build();
    expect(customer.firstName).toBe('Asha');
    expect(customer.lastName).toBe(aCustomer(1).build().lastName);
  });

  it('only ever use example.com email addresses', () => {
    for (const customer of aCustomer(7).buildMany(25)) expect(customer.email).toMatch(/@example\.com$/);
  });

  it('give each record in buildMany its own values', () => {
    const ids = aProduct(3)
      .buildMany(20)
      .map((p) => p.sku);
    expect(new Set(ids).size).toBe(20);
  });

  it('refuse to build invalid data, and say which seed produced it', () => {
    expect(() => aProduct(5).with({ priceCents: -1 }).build()).toThrow(
      /ProductBuilder built invalid data \(seed 5\)/,
    );
  });

  it('build invalid data on purpose with buildUnchecked, for negative tests', () => {
    expect(aProduct(5).with({ priceCents: -1 }).buildUnchecked().priceCents).toBe(-1);
  });
});

describe('orders', () => {
  it('recompute the total when a test sets the lines', () => {
    const order = anOrder(9)
      .withLines([
        { sku: 'ABC-00001', quantity: 2, unitPriceCents: 1_250 },
        { sku: 'XYZ-00002', quantity: 1, unitPriceCents: 999 },
      ])
      .build();
    expect(order.totalCents).toBe(3_499);
  });

  it('reject a total that does not match the lines', () => {
    expect(() => anOrder(9).with({ totalCents: 1 }).build()).toThrow(/totalCents must equal/);
  });

  it('take lines from a given catalogue, at catalogue prices', () => {
    const products = aProduct(11).buildMany(4);
    const order = anOrder(11).from(products).build();
    for (const line of order.lines) {
      expect(products.find((p) => p.sku === line.sku)?.priceCents).toBe(line.unitPriceCents);
    }
  });

  it('total is exact in cents', () => {
    expect(OrderBuilder.total([{ sku: 'ABC-00001', quantity: 3, unitPriceCents: 10 }])).toBe(30);
  });
});

describe('shop', () => {
  it('links every order to a known customer and known products', () => {
    const s = shop({ seed: 100, customers: 4, products: 6, ordersPerCustomer: 3 });
    expect(s.orders).toHaveLength(12);
    const customerIds = new Set(s.customers.map((c) => c.id));
    const skus = new Set(s.products.map((p) => p.sku));
    for (const order of s.orders) {
      expect(customerIds.has(order.customerId)).toBe(true);
      for (const line of order.lines) expect(skus.has(line.sku)).toBe(true);
    }
  });

  it('is reproducible from its seed', () => {
    expect(shop({ seed: 100 })).toEqual(shop({ seed: 100 }));
  });

  it('takes the seed from AIQA_SEED when none is given', () => {
    process.env.AIQA_SEED = '777';
    try {
      expect(shop().seed).toBe(777);
    } finally {
      delete process.env.AIQA_SEED;
    }
  });
});
