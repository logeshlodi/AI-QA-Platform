// Playwright MCP driving a real browser, the way an agent would: every capability group used once
// against a small orders page this test serves itself (never a public site).
// Run with:  pnpm test:mcp:playwright
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Client } from '@modelcontextprotocol/client';
import { REPO_ROOT, connectPlaywrightMcp } from './playwright-mcp';

const OUT = '.aiqa/playwright-mcp/live';
const ORDERS = [
  { id: 'ORD-1', status: 'PAID' },
  { id: 'ORD-2', status: 'SHIPPED' },
];

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Orders</title></head><body>
<main>
  <h1>Orders</h1>
  <form id="signin">
    <label>Username <input name="username" data-test="username"></label>
    <label>Password <input name="password" type="password" data-test="password"></label>
    <label><input type="checkbox" data-test="remember"> Remember me</label>
    <button data-test="sign-in">Sign in</button>
  </form>
  <p id="status" role="status"></p>
  <ul id="orders" aria-label="Orders"></ul>
  <button id="refresh" style="position:absolute;left:600px;top:420px;width:180px;height:44px">Refresh orders</button>
</main>
<script>
  const status = document.getElementById('status');
  async function load() {
    const list = await (await fetch('/api/orders')).json();
    document.getElementById('orders').replaceChildren(...list.map((o) => {
      const li = document.createElement('li'); li.textContent = o.id + ' ' + o.status; return li;
    }));
  }
  document.getElementById('signin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = e.target.username.value;
    localStorage.setItem('token', 't-' + user);
    document.cookie = 'session=abc123; path=/';
    status.textContent = 'Signed in as ' + user;
    await load();
  });
  document.getElementById('refresh').addEventListener('click', load);
</script></body></html>`;

let server: Server;
let base: string;
let mcp: Client;

/** Calls a tool, fails the test on a tool error, and returns its text. */
async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const res = await mcp.callTool({ name, arguments: args });
  const text = (res.content as { type: string; text?: string }[])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  expect(res.isError, `${name}: ${text}`).toBeFalsy();
  return text;
}

/** The snapshot reference of an element, found the way an agent reads it: by role and name. */
function ref(snapshot: string, role: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${role} "${escaped}"[^\\n]*\\[ref=(\\w+)\\]`).exec(snapshot);
  if (!match) throw new Error(`no ${role} "${name}" in the snapshot:\n${snapshot}`);
  return match[1]!;
}

beforeAll(async () => {
  rmSync(path.join(REPO_ROOT, OUT), { recursive: true, force: true });
  server = createServer((req, res) => {
    if (req.url === '/api/orders') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(ORDERS));
    } else {
      res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  mcp = await connectPlaywrightMcp();
}, 30_000);

afterAll(async () => {
  await mcp?.callTool({ name: 'browser_close', arguments: {} }).catch(() => undefined);
  await mcp?.close();
  // The browser can leave keep-alive connections open (seen on Windows); without this, close() waits.
  server?.closeAllConnections();
  await new Promise((resolve) => server?.close(resolve));
}, 30_000);

describe('Playwright MCP, every capability against a local page', () => {
  it('core: opens the page and reads it as an accessibility snapshot', async () => {
    await call('browser_navigate', { url: base });
    const snapshot = await call('browser_snapshot');
    expect(snapshot).toContain('heading "Orders"');
    expect(snapshot).toMatch(/textbox "Username"/);
  });

  it('core and testing: fills the form from snapshot references and verifies the values', async () => {
    const snapshot = await call('browser_snapshot');
    const username = ref(snapshot, 'textbox', 'Username');
    await call('browser_fill_form', {
      fields: [
        { name: 'Username', type: 'textbox', target: username, value: 'buyer' },
        { name: 'Password', type: 'textbox', target: '[data-test=password]', value: 'not-a-real-secret' },
        {
          name: 'Remember me',
          type: 'checkbox',
          target: ref(snapshot, 'checkbox', 'Remember me'),
          value: 'true',
        },
      ],
    });
    await call('browser_verify_value', {
      type: 'textbox',
      element: 'Username',
      target: username,
      value: 'buyer',
    });
    await call('browser_verify_value', {
      type: 'checkbox',
      element: 'Remember me',
      target: ref(snapshot, 'checkbox', 'Remember me'),
      value: 'true',
    });
    // The locator a person would paste into a spec, using the repository's data-test attribute.
    expect(await call('browser_generate_locator', { element: 'Username', target: username })).toContain(
      "getByTestId('username')",
    );
  });

  it('core and testing: signs in and verifies text, an element and a list', async () => {
    const snapshot = await call('browser_snapshot');
    await call('browser_click', { element: 'Sign in', target: ref(snapshot, 'button', 'Sign in') });
    await call('browser_verify_text_visible', { text: 'Signed in as buyer' });
    await call('browser_verify_element_visible', { role: 'button', accessibleName: 'Refresh orders' });
    const after = await call('browser_snapshot');
    await call('browser_verify_list_visible', {
      element: 'Orders',
      target: ref(after, 'list', 'Orders'),
      items: ['ORD-1 PAID', 'ORD-2 SHIPPED'],
    });
  });

  it('core: lists the API call the page made', async () => {
    const requests = await call('browser_network_requests', { static: false, filter: '/api/orders' });
    expect(requests).toContain('/api/orders');
    expect(requests).toContain('200');
  });

  it('storage: reads local storage and cookies, sets session storage, saves the state', async () => {
    expect(await call('browser_localstorage_get', { key: 'token' })).toContain('t-buyer');
    expect(await call('browser_cookie_list')).toContain('session');
    await call('browser_sessionstorage_set', { key: 'step', value: 'storage' });
    expect(await call('browser_sessionstorage_get', { key: 'step' })).toContain('storage');
    await call('browser_storage_state', { filename: `${OUT}/state.json` });
    const state = JSON.parse(readFileSync(path.join(REPO_ROOT, OUT, 'state.json'), 'utf8')) as {
      cookies: { name: string }[];
    };
    expect(state.cookies.map((c) => c.name)).toContain('session');
  });

  it('network, vision and devtools: mocks the API, clicks by coordinates, and records a trace', async () => {
    await call('browser_start_tracing');
    await call('browser_route', {
      pattern: '**/api/orders',
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'ORD-9', status: 'MOCKED' }]),
    });
    expect(await call('browser_route_list')).toContain('**/api/orders');

    // Vision: the button's box from the snapshot, then a click at its centre, no reference used.
    const boxes = await call('browser_snapshot', { boxes: true });
    const box =
      /button "Refresh orders"[^\n]*\[box=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\]/.exec(
        boxes,
      );
    expect(box, boxes).not.toBeNull();
    const [x, y, w, h] = box!.slice(1).map(Number) as [number, number, number, number];
    await call('browser_mouse_click_xy', { x: x + w / 2, y: y + h / 2 });
    await call('browser_verify_text_visible', { text: 'ORD-9 MOCKED' });

    await call('browser_unroute', { pattern: '**/api/orders' });
    expect(await call('browser_stop_tracing')).toMatch(/trace/i);
  });

  it('pdf and core: saves the page as a PDF and a full-page screenshot', async () => {
    await call('browser_pdf_save', { filename: `${OUT}/orders.pdf` });
    expect(
      readFileSync(path.join(REPO_ROOT, OUT, 'orders.pdf'))
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    await call('browser_take_screenshot', { filename: `${OUT}/orders.png`, fullPage: true, scale: 'css' });
    expect(existsSync(path.join(REPO_ROOT, OUT, 'orders.png'))).toBe(true);
  });

  it('config: reports the capabilities it was started with', async () => {
    const config = await call('browser_get_config');
    for (const cap of ['network', 'storage', 'testing', 'vision', 'pdf', 'devtools'])
      expect(config).toContain(cap);
  });
});
