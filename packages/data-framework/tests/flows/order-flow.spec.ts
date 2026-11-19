import { anOrder, orderSchema, type Order } from '@aiqa/test-data-engine';
import { expect, freshProducts, test } from '../../src/fixtures';
import { metricValue } from '../../src/metrics';
import { stack, TOPICS } from '../../src/stack';

const stockOf = async (db: import('pg').Pool, skus: string[]) =>
  Object.fromEntries(
    (
      await db.query<{ sku: string; stock: number }>('SELECT sku, stock FROM products WHERE sku = ANY($1)', [
        skus,
      ])
    ).rows.map((r) => [r.sku, r.stock]),
  );

const placed = (order: Order) => {
  // The service's message: the order without the fields only the test-data model has.
  const { id, customerId, currency, totalCents, lines } = order;
  return { id, customerId, currency, totalCents, lines };
};

test.describe('Order flow: Kafka in, Postgres and MongoDB, Kafka out', { tag: '@flow' }, () => {
  test('a valid order is confirmed, stored with its lines, reserves stock and is audited', async ({
    bus,
    db,
    mongo,
    service,
    seed,
    stockProducts,
  }) => {
    const products = await stockProducts(freshProducts(seed, 3, { stock: 10 }));
    const order = anOrder(seed).from(products).build();
    expect(orderSchema.safeParse(order).success).toBe(true);

    await bus.publish(TOPICS.placed, order.id, placed(order));

    await expect
      .poll(() => bus.messages(TOPICS.confirmed, (m) => m.key === order.id).map((m) => m.json))
      .toEqual([{ orderId: order.id, totalCents: order.totalCents }]);

    const stored = await service.get(`/orders/${order.id}`);
    expect(stored.status()).toBe(200);
    expect(await stored.json()).toEqual({
      id: order.id,
      customerId: order.customerId,
      status: 'confirmed',
      totalCents: order.totalCents,
      currency: 'USD',
      rejectionReason: null,
      lines: order.lines,
    });

    const stock = await stockOf(
      db,
      products.map((p) => p.sku),
    );
    for (const p of products) {
      const ordered = order.lines.filter((l) => l.sku === p.sku).reduce((n, l) => n + l.quantity, 0);
      expect(stock[p.sku], `stock of ${p.sku}`).toBe(10 - ordered);
    }

    const events = await mongo
      .collection('order_audit')
      .find({ orderId: order.id })
      .sort({ at: 1 })
      .toArray();
    expect(events.map((e) => e.event)).toEqual(['received', 'confirmed']);
  });

  test('an order for more than is in stock is rejected, and no stock moves', async ({
    bus,
    db,
    service,
    seed,
    stockProducts,
  }) => {
    const [plenty, scarce] = await stockProducts(
      freshProducts(seed, 2, { stock: 1 }).map((p, i) => ({ ...p, stock: i === 0 ? 50 : 1 })),
    );
    const order = anOrder(seed)
      .withLines([
        { sku: plenty!.sku, quantity: 2, unitPriceCents: plenty!.priceCents },
        { sku: scarce!.sku, quantity: 3, unitPriceCents: scarce!.priceCents },
      ])
      .build();

    await bus.publish(TOPICS.placed, order.id, placed(order));

    await expect
      .poll(() => bus.messages(TOPICS.rejected, (m) => m.key === order.id).map((m) => m.json))
      .toEqual([{ orderId: order.id, reason: `insufficient stock for ${scarce!.sku}: wanted 3, have 1` }]);
    // All or nothing: the line that could be reserved was not reserved either.
    expect(await stockOf(db, [plenty!.sku, scarce!.sku])).toEqual({ [plenty!.sku]: 50, [scarce!.sku]: 1 });
    expect(await (await service.get(`/orders/${order.id}`)).json()).toMatchObject({ status: 'rejected' });
  });

  test('an order for an unknown product is rejected with the SKU named', async ({ bus, seed }) => {
    const order = anOrder(seed)
      .withLines([{ sku: 'ZZZ-00000', quantity: 1, unitPriceCents: 500 }])
      .build();
    await bus.publish(TOPICS.placed, order.id, placed(order));
    await expect
      .poll(() => bus.messages(TOPICS.rejected, (m) => m.key === order.id).map((m) => m.json))
      .toEqual([{ orderId: order.id, reason: 'unknown sku ZZZ-00000' }]);
  });

  test('the same order delivered twice is processed once', async ({
    bus,
    db,
    request,
    seed,
    stockProducts,
  }) => {
    // Kafka delivers at least once, so every consumer must be idempotent.
    const products = await stockProducts(freshProducts(seed, 1, { stock: 10 }));
    const order = anOrder(seed)
      .withLines([{ sku: products[0]!.sku, quantity: 4, unitPriceCents: products[0]!.priceCents }])
      .build();
    const duplicates = async () =>
      metricValue(await (await request.get(stack.metricsUrl)).text(), 'orders_processed_total', {
        outcome: 'duplicate',
      });
    const before = await duplicates();

    await bus.publish(TOPICS.placed, order.id, placed(order));
    await expect.poll(() => bus.messages(TOPICS.confirmed, (m) => m.key === order.id).length).toBe(1);
    await bus.publish(TOPICS.placed, order.id, placed(order));

    // The service reports the duplicate in its metrics; that is how the test knows it has been handled.
    await expect.poll(duplicates).toBeGreaterThan(before);
    expect(bus.messages(TOPICS.confirmed, (m) => m.key === order.id)).toHaveLength(1);
    expect(await stockOf(db, [products[0]!.sku])).toEqual({ [products[0]!.sku]: 6 });
    const rows = await db.query('SELECT count(*)::int AS n FROM order_lines WHERE order_id = $1', [order.id]);
    expect(rows.rows[0].n).toBe(1);
  });

  const invalid: { name: string; payload: (o: Order) => unknown; reason: RegExp }[] = [
    { name: 'a message that is not JSON', payload: () => '{"id": oops', reason: /not JSON/ },
    {
      name: 'a total that does not match the lines',
      payload: (o) => ({ ...placed(o), totalCents: o.totalCents + 1 }),
      reason: /totalCents does not match the lines/,
    },
    {
      name: 'an order with no lines',
      payload: (o) => ({ ...placed(o), lines: [] }),
      reason: /expected array to have >=1|Too small/i,
    },
    {
      name: 'a currency the shop does not take',
      payload: (o) => ({ ...placed(o), currency: 'EUR' }),
      reason: /USD/,
    },
  ];

  for (const { name, payload, reason } of invalid) {
    test(`${name} goes to the dead-letter topic with a reason`, async ({ bus, service, seed }) => {
      const order = anOrder(seed).build();
      await bus.publish(TOPICS.placed, order.id, payload(order));
      await expect.poll(() => bus.messages(TOPICS.deadLetter, (m) => m.key === order.id).length).toBe(1);
      const [dead] = bus.messages(TOPICS.deadLetter, (m) => m.key === order.id);
      expect((dead!.json as { reason: string }).reason).toMatch(reason);
      expect((await service.get(`/orders/${order.id}`)).status()).toBe(404);
    });
  }
});

test.describe('Order service: observability', { tag: '@flow' }, () => {
  test('publishes processing metrics in Prometheus format', async ({ request }) => {
    const text = await (await request.get(stack.metricsUrl)).text();
    expect(text).toContain('# TYPE orders_processed_total counter');
    expect(text).toContain('# TYPE order_processing_seconds histogram');
  });
});
