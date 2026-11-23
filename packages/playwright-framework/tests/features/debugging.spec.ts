import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * Debugging aids beyond the trace the config records on retry:
 * - trace chunks: one trace file per phase of a long test, so a failure opens on the part that matters;
 * - the network log every test keeps (src/checks/network-log.ts), attached when a test fails, with
 *   slow requests named in an annotation;
 * - `page.pause()`, which opens the Inspector when you debug (`pnpm test:debug`) and does nothing in a
 *   normal run because it is behind PWDEBUG.
 * This file records its own traces, so the config's trace setting is off here.
 */
test.use({ trace: 'off' });

let server: http.Server;
let base: string;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const send = (status: number, body: string, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    if (req.url === '/') {
      return send(
        200,
        html(
          'Orders',
          `<ul id="orders"></ul><p id="status" role="status"></p>
           <script>
             Promise.all([fetch('/api/orders'), fetch('/api/recommendations'), fetch('/api/missing')])
               .then(() => (document.getElementById('status').textContent = 'loaded'));
           </script>`,
        ),
        'text/html',
      );
    }
    if (req.url === '/api/orders') return send(200, '[]');
    if (req.url === '/api/recommendations') return void setTimeout(() => send(200, '[]'), 400);
    return send(404, '{"error":"not found"}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test.describe('network log', () => {
  test.use({ slowRequestMs: 250 });

  test('records every request with its status and time, and flags the slow and the failed', async ({
    page,
    networkLog,
  }) => {
    await page.goto(`${base}/`);
    await expect(page.getByRole('status')).toHaveText('loaded');

    const api = () => networkLog.entries.filter((e) => e.url.includes('/api/'));
    await expect.poll(() => api().length).toBe(3);
    expect(
      api()
        .map((e) => [new URL(e.url).pathname, e.status])
        .sort(),
    ).toEqual([
      ['/api/missing', 404],
      ['/api/orders', 200],
      ['/api/recommendations', 200],
    ]);
    expect(networkLog.slow.map((e) => new URL(e.url).pathname)).toEqual(['/api/recommendations']);
    expect(networkLog.errors.map((e) => new URL(e.url).pathname)).toEqual(['/api/missing']);
  });
});

test('trace chunks: one trace per phase of a test', async ({ context, page }, testInfo) => {
  await serveLocal(page, {
    '/': html('Shop', '<button onclick="this.textContent=\'Added\'">Add to cart</button>'),
    '/checkout': html('Checkout', '<label>Card <input></label><button>Pay</button>'),
  });
  await context.tracing.start({ screenshots: true, snapshots: true });

  await context.tracing.startChunk({ title: 'browse' });
  await page.goto(`${LOCAL_ORIGIN}/`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('button', { name: 'Added' })).toBeVisible();
  const browse = testInfo.outputPath('trace-browse.zip');
  await context.tracing.stopChunk({ path: browse });

  await context.tracing.startChunk({ title: 'checkout' });
  await page.goto(`${LOCAL_ORIGIN}/checkout`);
  await page.getByLabel('Card').fill('4242 4242 4242 4242');
  const checkout = testInfo.outputPath('trace-checkout.zip');
  await context.tracing.stopChunk({ path: checkout });
  await context.tracing.stop();

  // Two separate traces, each openable on its own: npx playwright show-trace <file>
  for (const file of [browse, checkout]) {
    expect(fs.statSync(file).size).toBeGreaterThan(1_000);
    await testInfo.attach(file.endsWith('browse.zip') ? 'trace: browse' : 'trace: checkout', {
      path: file,
      contentType: 'application/zip',
    });
  }
});

test('page.pause() opens the Inspector only when debugging', async ({ page }) => {
  await serveLocal(page, { '/': html('Pause', '<h1>Stop here and look around</h1>') });
  await page.goto(`${LOCAL_ORIGIN}/`);
  // `pnpm test:debug tests/features/debugging.spec.ts` sets PWDEBUG and stops here with the Inspector
  // open: step through, try locators, then resume. A normal run carries on.
  if (process.env.PWDEBUG) {
    // eslint-disable-next-line playwright/no-page-pause -- the point of this example, behind PWDEBUG
    await page.pause();
  }
  await expect(page.getByRole('heading')).toHaveText('Stop here and look around');
});
