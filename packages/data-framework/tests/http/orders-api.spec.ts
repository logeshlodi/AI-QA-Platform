import { anOrder, type Order } from '@aiqa/test-data-engine';
import { expect, freshProducts, test } from '../../src/fixtures';

// The service's HTTP front door, which the k6 load tests drive: catalogue upkeep and placing orders.
// Placing an order over HTTP goes through the same Kafka path the flow specs test directly.

const body = ({ id, customerId, currency, totalCents, lines }: Order) => ({
  id,
  customerId,
  currency,
  totalCents,
  lines,
});

test.describe('Order service HTTP API', { tag: '@http' }, () => {
  test('PUT /products/:sku creates a product, then replaces it', async ({ catalogAdmin, db, seed }) => {
    const [p] = freshProducts(seed, 1);
    try {
      const created = await catalogAdmin.put(`/products/${p!.sku}`, {
        data: { name: p!.name, priceCents: 1999, stock: 5 },
      });
      expect(created.status()).toBe(201);
      const updated = await catalogAdmin.put(`/products/${p!.sku}`, {
        data: { name: p!.name, priceCents: 2499, stock: 7 },
      });
      expect(updated.status()).toBe(200);
      const row = await db.query('SELECT price_cents, stock FROM products WHERE sku = $1', [p!.sku]);
      expect(row.rows).toEqual([{ price_cents: 2499, stock: 7 }]);
    } finally {
      await db.query('DELETE FROM products WHERE sku = $1', [p!.sku]);
    }
  });

  test('PUT /products/:sku refuses a price of zero and names the problem', async ({ catalogAdmin, seed }) => {
    const [p] = freshProducts(seed, 1);
    const response = await catalogAdmin.put(`/products/${p!.sku}`, {
      data: { name: 'x', priceCents: 0, stock: 1 },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatch(/>=1/);
  });

  test('POST /orders accepts a valid order with 202, and it is then confirmed', async ({
    service,
    seed,
    stockProducts,
  }) => {
    const products = await stockProducts(freshProducts(seed, 2, { stock: 10 }));
    const order = anOrder(seed).from(products).build();

    const accepted = await service.post('/orders', { data: body(order) });
    expect(accepted.status()).toBe(202);
    expect(await accepted.json()).toEqual({ orderId: order.id, status: 'accepted' });

    await expect
      .poll(async () => {
        const stored = await service.get(`/orders/${order.id}`);
        return stored.ok() ? (await stored.json()).status : stored.status();
      })
      .toBe('confirmed');
  });

  test('POST /orders refuses an order whose total does not match its lines, before Kafka', async ({
    service,
    seed,
  }) => {
    const order = anOrder(seed).build();
    const response = await service.post('/orders', {
      data: { ...body(order), totalCents: order.totalCents + 1 },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain('totalCents does not match the lines');
    expect((await service.get(`/orders/${order.id}`)).status()).toBe(404);
  });

  test('POST /orders refuses a body that is not JSON, and one over 64 KB', async ({ service }) => {
    const notJson = await service.post('/orders', {
      headers: { 'content-type': 'application/json' },
      data: '{"id": ',
    });
    expect(notJson.status()).toBe(400);
    const huge = await service.post('/orders', { data: { padding: 'x'.repeat(70 * 1024) } });
    expect(huge.status()).toBe(413);
  });
});
