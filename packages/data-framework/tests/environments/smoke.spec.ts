import { randomUUID } from 'node:crypto';
import { expect, test } from '../../src/environments';

// The deployment smoke for one environment, run against every environment in
// infrastructure/environments.json at once (`pnpm test:matrix`): one project each, one report.
// Only what any deployment exposes over HTTP, so the same checks hold in Docker and in Kubernetes.

test.describe('A deployment of the order service', { tag: '@matrix' }, () => {
  test('reports itself ready', async ({ service }) => {
    const health = await service.get('/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ ready: true });
  });

  test('serves its OpenAPI document with the order endpoints', async ({ service }) => {
    const doc = await (await service.get('/openapi.json')).json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/orders', '/orders/{id}', '/health']));
  });

  test('exposes its metrics for Prometheus', async ({ environment, playwright }) => {
    const ctx = await playwright.request.newContext();
    const metrics = await ctx.get(environment.metricsUrl);
    expect(metrics.status()).toBe(200);
    expect(await metrics.text()).toContain('# HELP');
    await ctx.dispose();
  });

  test('refuses a catalogue change without a token', async ({ service }) => {
    const put = await service.put(`/products/MATRIX-${Date.now()}`, {
      data: { name: 'x', priceCents: 100, stock: 1 },
    });
    expect(put.status()).toBe(401);
  });

  test('takes an order end to end: accepted over HTTP, decided through Kafka and stored', async ({
    service,
  }) => {
    // A product no environment has, so the outcome is the same everywhere: rejected, with a reason.
    const order = {
      id: randomUUID(),
      customerId: randomUUID(),
      currency: 'USD',
      totalCents: 500,
      lines: [{ sku: `MATRIX-${randomUUID().slice(0, 8)}`, quantity: 1, unitPriceCents: 500 }],
    };
    const accepted = await service.post('/orders', { data: order });
    expect(accepted.status()).toBe(202);
    await expect
      .poll(
        async () => {
          const stored = await service.get(`/orders/${order.id}`);
          return stored.ok() ? (await stored.json()).status : stored.status();
        },
        { timeout: 20_000 },
      )
      .toBe('rejected');
  });
});
