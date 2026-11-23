import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '../../src/fixtures';

/**
 * Changing a request on its way out with `route.continue()`: headers added or removed, the method and
 * body replaced. The request still goes to the real server; a small local one echoes what it received,
 * so the spec sees what actually arrived. (network-mocking.spec.ts changes responses instead.)
 */
let server: http.Server;
let base: string;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers, body }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

type Echo = { method: string; url: string; headers: Record<string, string>; body: string };
const echoOf = async (page: import('@playwright/test').Page) =>
  JSON.parse((await page.locator('body').textContent()) ?? '{}') as Echo;

test.describe('route.continue', () => {
  test('adds a header the app would not send, and drops one it would', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-tracking-id': 'abc-123' });
    await page.route(`${base}/**`, async (route) => {
      const headers = route.request().headers();
      delete headers['x-tracking-id'];
      await route.continue({
        headers: { ...headers, 'x-test-run': 'aiqa', 'x-feature-flag': 'new-checkout' },
      });
    });

    await page.goto(`${base}/orders`);
    const echo = await echoOf(page);
    expect(echo.headers['x-test-run']).toBe('aiqa');
    expect(echo.headers['x-feature-flag']).toBe('new-checkout');
    expect(echo.headers).not.toHaveProperty('x-tracking-id');
  });

  test('turns a GET into a POST with a body, and changes the URL', async ({ page }) => {
    await page.route(`${base}/search**`, (route) =>
      route.continue({
        method: 'POST',
        url: `${base}/api/search`,
        postData: JSON.stringify({ query: 'backpack', limit: 5 }),
        headers: { ...route.request().headers(), 'content-type': 'application/json' },
      }),
    );

    await page.goto(`${base}/search?q=ignored`);
    const echo = await echoOf(page);
    expect(echo).toMatchObject({ method: 'POST', url: '/api/search' });
    expect(JSON.parse(echo.body)).toEqual({ query: 'backpack', limit: 5 });
  });

  test('fallback passes a changed request on to the next handler instead of the network', async ({
    page,
  }) => {
    // Handlers run newest first; fallback() hands on to the older one, with its changes kept.
    await page.route(`${base}/**`, (route) => route.continue());
    await page.route(`${base}/**`, (route) =>
      route.fallback({ headers: { ...route.request().headers(), authorization: 'Bearer test-token' } }),
    );

    await page.goto(`${base}/me`);
    expect((await echoOf(page)).headers.authorization).toBe('Bearer test-token');
  });
});
