import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '../../src/fixtures';

/**
 * Service workers sit between a page and the network: they can answer requests from a cache,
 * which is how apps work offline, and they can hide requests from page.route().
 * A worker only registers on https or localhost, so this spec starts a tiny local site.
 * Chromium only: Playwright exposes service workers there and nowhere else.
 */
const WORKER = `
  self.addEventListener('install', (event) =>
    event.waitUntil(caches.open('v1').then((cache) => cache.addAll(['/', '/data.json'])).then(() => self.skipWaiting())));
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', (event) => {
    if (new URL(event.request.url).pathname === '/live.json') return event.respondWith(fetch('/live.json'));
    event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
  });`;

const PAGE = `<!doctype html><title>Service worker lab</title>
  <h1 id="status">loading</h1><p id="data"></p><p id="live"></p>
  <script>
    const show = (id, url) => fetch(url).then((r) => r.json()).then((d) => (document.getElementById(id).textContent = d.message));
    show('data', '/data.json');
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => (document.getElementById('status').textContent = 'ready'))
      .catch(() => (document.getElementById('status').textContent = 'no worker'));
    window.loadLive = () => show('live', '/live.json');
  </script>`;

const FILES: Record<string, [type: string, body: string]> = {
  '/': ['text/html', PAGE],
  '/sw.js': ['text/javascript', WORKER],
  '/data.json': ['application/json', '{"message":"from the server"}'],
  '/live.json': ['application/json', '{"message":"live from the server"}'],
};

let server: http.Server;
let origin: string;

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const file = FILES[request.url ?? '/'];
    if (!file) return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': file[0] }).end(file[1]);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.describe('service workers', { tag: '@lab' }, () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'service worker support is Chromium-only');

  test('a registered worker is visible on the browser context', async ({ page, context }) => {
    await page.goto(origin);
    await expect(page.locator('#status')).toHaveText('ready');
    expect(context.serviceWorkers().map((worker) => new URL(worker.url()).pathname)).toEqual(['/sw.js']);
  });

  test('the page keeps working offline, served from the worker cache', async ({ page, context }) => {
    await page.goto(origin);
    await expect(page.locator('#status')).toHaveText('ready');

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#data')).toHaveText('from the server');
  });

  test('context.route sees a request the worker makes itself', async ({ page, context }) => {
    let madeByWorker = false;
    await context.route('**/live.json', async (route) => {
      madeByWorker = route.request().serviceWorker() !== null;
      await route.fulfill({ json: { message: 'mocked for the worker' } });
    });
    await page.goto(origin);
    await expect(page.locator('#status')).toHaveText('ready');

    await page.evaluate(() => (window as unknown as { loadLive: () => void }).loadLive());
    await expect(page.locator('#live')).toHaveText('mocked for the worker');
    expect(madeByWorker).toBe(true);
  });

  test.describe('with workers blocked', () => {
    // The simplest way to make page.route() see everything: do not let the worker install.
    test.use({ serviceWorkers: 'block' });

    test('no worker installs and page.route mocks the request', async ({ page, context }) => {
      await page.route('**/data.json', (route) => route.fulfill({ json: { message: 'mocked' } }));
      await page.goto(origin);
      await expect(page.locator('#data')).toHaveText('mocked');
      expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(
        0,
      );
      expect(context.serviceWorkers()).toHaveLength(0);
    });
  });
});
