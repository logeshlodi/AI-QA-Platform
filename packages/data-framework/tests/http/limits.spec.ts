import { anOrder, type Order } from '@aiqa/test-data-engine';
import { expect, freshProducts, test } from '../../src/fixtures';
import { TOPICS } from '../../src/stack';

// Regression for a bug the ZAP scan found (20 Nov 2026): amounts above the INTEGER columns' range
// (2,147,483,647) passed validation and failed in Postgres. Over HTTP that was a 500 that echoed the
// database error. Over Kafka the service stopped on the message without committing it, so it stopped
// again on every restart: one anonymous POST /orders took order processing down. The re-scan then
// found a NUL character (0x00) in a product name doing the same: Postgres text cannot hold it.

const TOO_BIG = 2_147_483_648;
const body = ({ id, customerId, currency, totalCents, lines }: Order) => ({
  id,
  customerId,
  currency,
  totalCents,
  lines,
});
const oversized = (order: Order) => ({
  ...body(order),
  totalCents: TOO_BIG,
  lines: [{ sku: order.lines[0]!.sku, quantity: 1, unitPriceCents: TOO_BIG }],
});

test.describe('Values the database cannot hold', { tag: '@limits' }, () => {
  test('PUT /products/{sku} refuses a price or stock out of range with 400, not 500', async ({
    catalogAdmin,
    db,
    seed,
  }) => {
    const [p] = freshProducts(seed, 1);
    for (const data of [
      { name: p!.name, priceCents: TOO_BIG, stock: 1 },
      { name: p!.name, priceCents: 100, stock: TOO_BIG },
    ]) {
      const response = await catalogAdmin.put(`/products/${p!.sku}`, { data });
      expect(response.status()).toBe(400);
      const { error } = await response.json();
      expect(error).toMatch(/2147483647/);
      expect(error).not.toMatch(/out of range for type integer/); // the database's words never reach the caller
    }
    expect((await db.query('SELECT 1 FROM products WHERE sku = $1', [p!.sku])).rowCount).toBe(0);
  });

  test('POST /orders refuses an out-of-range price before it reaches Kafka', async ({ service, seed }) => {
    const order = anOrder(seed).build();
    const response = await service.post('/orders', { data: oversized(order) });
    expect(response.status()).toBe(400);
    expect((await service.get(`/orders/${order.id}`)).status()).toBe(404);
  });

  test('on Kafka, an out-of-range order goes to the dead-letter topic and the partition keeps going', async ({
    bus,
    service,
    seed,
    stockProducts,
  }) => {
    const products = await stockProducts(freshProducts(seed, 1, { stock: 10 }));
    const bad = anOrder(seed).from(products).build();
    const good = anOrder(seed + 1)
      .from(products)
      .build();

    // Same key, so the same partition, in this order: the good order queues behind the bad one.
    await bus.publish(TOPICS.placed, bad.id, oversized(bad));
    await bus.publish(TOPICS.placed, bad.id, body(good));

    await expect.poll(() => bus.messages(TOPICS.deadLetter, (m) => m.key === bad.id).length).toBe(1);
    const [dead] = bus.messages(TOPICS.deadLetter, (m) => m.key === bad.id);
    expect((dead!.json as { reason: string }).reason).toMatch(/2147483647/);

    await expect
      .poll(async () => {
        const stored = await service.get(`/orders/${good.id}`);
        return stored.ok() ? (await stored.json()).status : stored.status();
      })
      .toBe('confirmed');
    expect((await service.get('/health')).status()).toBe(200);
  });

  test('a NUL character is refused with 400 on HTTP and dead-lettered on Kafka', async ({
    catalogAdmin,
    bus,
    service,
    seed,
    stockProducts,
  }) => {
    const [p] = freshProducts(seed, 1);
    const response = await catalogAdmin.put(`/products/${p!.sku}`, {
      data: { name: 'lamp\u0000', priceCents: 100, stock: 1 },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatch(/control characters/);

    const products = await stockProducts(freshProducts(seed + 2, 1, { stock: 10 }));
    const bad = anOrder(seed + 3)
      .from(products)
      .build();
    const good = anOrder(seed + 4)
      .from(products)
      .build();
    await bus.publish(TOPICS.placed, bad.id, {
      ...body(bad),
      lines: [{ ...bad.lines[0]!, sku: 'NUL\u0000SKU' }],
    });
    await bus.publish(TOPICS.placed, bad.id, body(good));
    await expect.poll(() => bus.messages(TOPICS.deadLetter, (m) => m.key === bad.id).length).toBe(1);
    await expect
      .poll(async () => {
        const stored = await service.get(`/orders/${good.id}`);
        return stored.ok() ? (await stored.json()).status : stored.status();
      })
      .toBe('confirmed');
  });
});
