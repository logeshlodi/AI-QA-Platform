import { randomUUID } from 'node:crypto';
import { expect, freshProducts, test } from '../../src/fixtures';

// The service handles its Kafka partitions in parallel. Orders that share products then reserve
// stock in concurrent transactions; locking product rows in line order deadlocked as soon as two
// orders listed the same products in opposite orders (found by the k6 stress run, 20 Nov 2026).
test.describe('Order flow under concurrency', { tag: '@flow' }, () => {
  test('orders that list the same products in opposite orders all go through, and stock adds up', async ({
    db,
    service,
    seed,
    stockProducts,
  }) => {
    test.setTimeout(60_000);
    const [a, b] = await stockProducts(freshProducts(seed, 2, { stock: 1000 }));
    const orders = Array.from({ length: 60 }, (_, i) => {
      const [first, second] = i % 2 === 0 ? [a!, b!] : [b!, a!];
      const lines = [
        { sku: first.sku, quantity: 1 + (i % 3), unitPriceCents: first.priceCents },
        { sku: second.sku, quantity: 1, unitPriceCents: second.priceCents },
      ];
      return {
        id: randomUUID(),
        customerId: randomUUID(),
        currency: 'USD' as const,
        totalCents: lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0),
        lines,
      };
    });

    // All at once: random order ids spread them over the three partitions.
    const accepted = await Promise.all(orders.map((data) => service.post('/orders', { data })));
    expect(accepted.map((r) => r.status())).toEqual(orders.map(() => 202));

    await expect
      .poll(
        async () => {
          const rows = await db.query<{ status: string; n: string }>(
            'SELECT status, count(*) AS n FROM orders WHERE id = ANY($1) GROUP BY status',
            [orders.map((o) => o.id)],
          );
          return Object.fromEntries(rows.rows.map((r) => [r.status, Number(r.n)]));
        },
        { timeout: 30_000 },
      )
      .toEqual({ confirmed: 60 });

    const ordered = (sku: string) =>
      orders
        .flatMap((o) => o.lines)
        .filter((l) => l.sku === sku)
        .reduce((n, l) => n + l.quantity, 0);
    const stock = await db.query<{ sku: string; stock: number }>(
      'SELECT sku, stock FROM products WHERE sku = ANY($1)',
      [[a!.sku, b!.sku]],
    );
    expect(Object.fromEntries(stock.rows.map((r) => [r.sku, r.stock]))).toEqual({
      [a!.sku]: 1000 - ordered(a!.sku),
      [b!.sku]: 1000 - ordered(b!.sku),
    });
  });
});
