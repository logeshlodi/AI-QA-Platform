import type { Faker } from '@faker-js/faker';
import type { z } from 'zod';
import { defaultSeed, seededFaker } from './random';
import {
  customerSchema,
  orderSchema,
  productSchema,
  type Customer,
  type Order,
  type OrderLine,
  type Product,
} from './schemas';

/**
 * Builder base: random but valid defaults, `with()` for the fields a test cares about, and
 * `build()` that validates against the schema. A builder that produces invalid data fails
 * loudly here, not three steps later inside the system under test.
 */
abstract class Builder<T> {
  protected overrides: Partial<T> = {};
  protected readonly faker: Faker;
  readonly seed: number;

  constructor(seed = defaultSeed()) {
    this.seed = seed;
    this.faker = seededFaker(seed);
  }

  protected abstract readonly schema: z.ZodType<T>;
  protected abstract defaults(): T;

  with(fields: Partial<T>): this {
    this.overrides = { ...this.overrides, ...fields };
    return this;
  }

  build(): T {
    const value = { ...this.defaults(), ...this.overrides };
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `${this.constructor.name} built invalid data (seed ${this.seed}): ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  /** Several records. Each gets its own derived seed, so the list is reproducible too. */
  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.with({}).build());
  }

  /** Skips validation: only for tests that send invalid data on purpose (negative tests). */
  buildUnchecked(): T {
    return { ...this.defaults(), ...this.overrides };
  }
}

const CATEGORIES = productSchema.shape.category.options;

export class CustomerBuilder extends Builder<Customer> {
  protected readonly schema = customerSchema;
  protected defaults(): Customer {
    const f = this.faker;
    const firstName = f.person.firstName();
    const lastName = f.person.lastName();
    return {
      id: f.string.uuid(),
      // example.com is reserved for documentation (RFC 2606): these addresses can never reach a real inbox.
      email: f.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase(),
      firstName,
      lastName,
      address: {
        line1: f.location.streetAddress(),
        city: f.location.city(),
        postcode: f.location.zipCode(),
        country: f.helpers.arrayElement(['US', 'GB', 'IN', 'DE', 'FR']),
      },
      createdAt: f.date.recent({ days: 30 }).toISOString(),
    };
  }
}

export class ProductBuilder extends Builder<Product> {
  protected readonly schema = productSchema;
  protected defaults(): Product {
    const f = this.faker;
    return {
      sku: `${f.string.alpha({ length: 3, casing: 'upper' })}-${f.string.numeric(5)}`,
      name: f.commerce.productName(),
      category: f.helpers.arrayElement(CATEGORIES),
      priceCents: f.number.int({ min: 199, max: 49_999 }),
      stock: f.number.int({ min: 0, max: 500 }),
    };
  }
}

export class OrderBuilder extends Builder<Order> {
  protected readonly schema = orderSchema;
  private products: Product[] = [];

  /** Order lines come from these products, at their prices. Without it, products are invented. */
  from(products: Product[]): this {
    this.products = products;
    return this;
  }

  forCustomer(customer: Pick<Customer, 'id'>): this {
    return this.with({ customerId: customer.id });
  }

  /** Lines in, total recomputed: the order stays valid whatever lines a test sets. */
  withLines(lines: OrderLine[]): this {
    return this.with({ lines, totalCents: OrderBuilder.total(lines) });
  }

  static total(lines: OrderLine[]): number {
    return lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  }

  protected defaults(): Order {
    const f = this.faker;
    const catalog = this.products.length > 0 ? this.products : new ProductBuilder(this.seed).buildMany(5);
    const picked = f.helpers.arrayElements(catalog, { min: 1, max: Math.min(3, catalog.length) });
    const lines = picked.map((p) => ({
      sku: p.sku,
      quantity: f.number.int({ min: 1, max: 4 }),
      unitPriceCents: p.priceCents,
    }));
    return {
      id: f.string.uuid(),
      customerId: f.string.uuid(),
      status: 'created',
      lines,
      totalCents: OrderBuilder.total(lines),
      currency: 'USD',
      createdAt: f.date.recent({ days: 7 }).toISOString(),
    };
  }
}

/** Fluent entry points: `aCustomer().with({ ... }).build()`. */
export const aCustomer = (seed?: number) => new CustomerBuilder(seed);
export const aProduct = (seed?: number) => new ProductBuilder(seed);
export const anOrder = (seed?: number) => new OrderBuilder(seed);
