import { anOrder, type Order } from '@aiqa/test-data-engine';
import type { APIResponse } from '@playwright/test';
import type { ContractChecker } from '../../src/openapi';
import { expect, freshProducts, test } from '../../src/fixtures';

// Every response the service can give, checked against the OpenAPI document it publishes at
// GET /openapi.json: the status must be one the document lists, and the body must match its schema.
// The other HTTP specs check behaviour; these check the shape a client of the API relies on.

const body = ({ id, customerId, currency, totalCents, lines }: Order) => ({
  id,
  customerId,
  currency,
  totalCents,
  lines,
});

async function expectToMatch(contract: ContractChecker, method: string, path: string, response: APIResponse) {
  const result = await contract.check(method, path, response);
  expect(result.problems, `${method} ${path} -> ${response.status()}`).toEqual([]);
}

test.describe('Order service against its OpenAPI document', { tag: '@contract' }, () => {
  test('the document is OpenAPI 3.1 and lists every route', ({ contract }) => {
    expect(contract.document.openapi).toBe('3.1.0');
    expect(Object.keys(contract.document.paths).sort()).toEqual([
      '/health',
      '/orders',
      '/orders/{id}',
      '/products/{sku}',
    ]);
  });

  test('every answer carries nosniff and same-origin (from the ZAP scan)', async ({ service }) => {
    for (const response of [
      await service.get('/health'),
      await service.get('/openapi.json'),
      await service.get(`/orders/${crypto.randomUUID()}`),
      await service.post('/orders', { data: {} }),
    ]) {
      expect(response.headers()['x-content-type-options']).toBe('nosniff');
      expect(response.headers()['cross-origin-resource-policy']).toBe('same-origin');
    }
  });

  test('GET /health', async ({ service, contract }) => {
    await expectToMatch(contract, 'GET', '/health', await service.get('/health'));
  });

  test('PUT /products/{sku}: created, replaced, refused', async ({ catalogAdmin, contract, db, seed }) => {
    const [p] = freshProducts(seed, 1);
    try {
      const created = await catalogAdmin.put(`/products/${p!.sku}`, {
        data: { name: p!.name, priceCents: 1500, stock: 3 },
      });
      expect(created.status()).toBe(201);
      await expectToMatch(contract, 'PUT', '/products/{sku}', created);

      const replaced = await catalogAdmin.put(`/products/${p!.sku}`, {
        data: { name: p!.name, priceCents: 1600, stock: 4 },
      });
      expect(replaced.status()).toBe(200);
      await expectToMatch(contract, 'PUT', '/products/{sku}', replaced);

      const refused = await catalogAdmin.put(`/products/${p!.sku}`, {
        data: { name: '', priceCents: 0, stock: -1 },
      });
      expect(refused.status()).toBe(400);
      await expectToMatch(contract, 'PUT', '/products/{sku}', refused);
    } finally {
      await db.query('DELETE FROM products WHERE sku = $1', [p!.sku]);
    }
  });

  test('POST /orders: accepted, then read back confirmed', async ({
    service,
    contract,
    seed,
    stockProducts,
  }) => {
    const products = await stockProducts(freshProducts(seed, 2, { stock: 10 }));
    const order = anOrder(seed).from(products).build();

    const accepted = await service.post('/orders', { data: body(order) });
    expect(accepted.status()).toBe(202);
    await expectToMatch(contract, 'POST', '/orders', accepted);

    await expect
      .poll(async () => (await service.get(`/orders/${order.id}`)).status(), { timeout: 15_000 })
      .toBe(200);
    await expectToMatch(contract, 'GET', '/orders/{id}', await service.get(`/orders/${order.id}`));
  });

  test('GET /orders/{id} for a rejected order carries its reason', async ({
    service,
    contract,
    seed,
    stockProducts,
  }) => {
    const [scarce] = await stockProducts(freshProducts(seed, 1, { stock: 1 }));
    const order = anOrder(seed)
      .withLines([{ sku: scarce!.sku, quantity: 2, unitPriceCents: scarce!.priceCents }])
      .build();
    expect((await service.post('/orders', { data: body(order) })).status()).toBe(202);

    await expect
      .poll(async () => {
        const stored = await service.get(`/orders/${order.id}`);
        return stored.ok() ? (await stored.json()).status : stored.status();
      })
      .toBe('rejected');
    const rejected = await service.get(`/orders/${order.id}`);
    await expectToMatch(contract, 'GET', '/orders/{id}', rejected);
    expect((await rejected.json()).rejectionReason).toContain(scarce!.sku);
  });

  test('the refusals: invalid order, not JSON, too large, unknown order', async ({
    service,
    contract,
    seed,
  }) => {
    const order = anOrder(seed).build();
    const invalid = await service.post('/orders', {
      data: { ...body(order), totalCents: order.totalCents + 1 },
    });
    const notJson = await service.post('/orders', {
      headers: { 'content-type': 'application/json' },
      data: '{"id": ',
    });
    const tooLarge = await service.post('/orders', { data: { padding: 'x'.repeat(70 * 1024) } });
    expect([invalid.status(), notJson.status(), tooLarge.status()]).toEqual([400, 400, 413]);
    for (const response of [invalid, notJson, tooLarge])
      await expectToMatch(contract, 'POST', '/orders', response);

    const unknown = await service.get(`/orders/${crypto.randomUUID()}`);
    expect(unknown.status()).toBe(404);
    await expectToMatch(contract, 'GET', '/orders/{id}', unknown);
  });

  // The checker must be able to fail, or every check above proves nothing.
  test('the checker reports a response that breaks the contract', async ({
    catalogAdmin,
    contract,
    seed,
    db,
  }) => {
    const [p] = freshProducts(seed, 1);
    try {
      const created = await catalogAdmin.put(`/products/${p!.sku}`, {
        data: { name: p!.name, priceCents: 900, stock: 1 },
      });
      // A product response checked as if it answered GET /orders/{id}: wrong status for that operation.
      expect((await contract.check('GET', '/orders/{id}', created)).problems).toEqual([
        'status 201 is not documented (documented: 200, 404)',
      ]);
      // And an undocumented route.
      expect((await contract.check('DELETE', '/orders/{id}', created)).ok).toBe(false);
    } finally {
      await db.query('DELETE FROM products WHERE sku = $1', [p!.sku]);
    }
  });
});
