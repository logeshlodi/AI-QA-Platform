# Playwright cheat sheet

One page of the Playwright API as this repository uses it. Every line points to a feature a spec here
exercises; the [coverage matrix](coverage-matrix.md) says which spec.

## Commands

```bash
npx pnpm test:ui                                  # the UI suite, all browsers
npx pnpm test:smoke                               # @smoke only
npx pnpm --filter @aiqa/playwright-framework exec playwright test checkout --project=chromium
npx pnpm --filter @aiqa/playwright-framework exec playwright test -g "locked-out"   # by title
npx pnpm --filter @aiqa/playwright-framework exec playwright test --ui              # UI mode
npx pnpm test:debug                               # inspector, step by step
npx pnpm --filter @aiqa/playwright-framework exec playwright codegen https://www.saucedemo.com
npx pnpm report:html                              # last HTML report, traces inside
npx pnpm --filter @aiqa/playwright-framework exec playwright show-trace trace.zip
```

Useful flags: `--headed`, `--workers=1`, `--retries=0`, `--repeat-each=5`, `--last-failed`,
`--only-changed`, `--shard=1/4`, `--update-snapshots`, `--grep-invert @slow`.

## Locators (in order of preference)

```ts
page.getByRole('button', { name: 'Add to cart' });
page.getByLabel('Password');
page.getByPlaceholder('Search');
page.getByText('Thank you for your order', { exact: true });
page.getByTestId('inventory-item'); // testIdAttribute is set in the config
page.locator('.cart_item').filter({ hasText: 'Backpack' }).getByRole('button');
page.getByRole('row').nth(2); // only when position is the point
page.frameLocator('#payment').getByLabel('Card number');
locator.describe('cart badge'); // names it in traces and reports
```

## Actions

```ts
await locator.click();
await locator.dblclick();
await locator.hover();
await locator.fill('text');
await locator.pressSequentially('abc', { delay: 50 });
await locator.press('Enter');
await page.keyboard.press('ControlOrMeta+V');
await locator.check();
await locator.selectOption('Price (low to high)');
await locator.setInputFiles(['a.csv', 'b.csv']);
await locator.dragTo(target);
await locator.tap(); // tap needs hasTouch
await locator.scrollIntoViewIfNeeded();
```

## Assertions (web-first: they retry)

```ts
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).toHaveText('3');
await expect(locator).toContainText('Backpack');
await expect(locator).toHaveCount(6);
await expect(locator).toHaveValue('standard_user');
await expect(locator).toHaveAttribute('aria-expanded', 'true');
await expect(locator).toBeEnabled();
await expect(locator).toBeChecked();
await expect(page).toHaveURL(/checkout-complete/);
await expect(page).toHaveTitle('Swag Labs');
await expect(locator).toMatchAriaSnapshot(`- heading "Products"`);
await expect(page).toHaveScreenshot({ mask: [page.locator('.clock')] });
await expect.soft(locator).toHaveText('…'); // record, keep going
await expect.poll(() => api.orderStatus(id)).toBe('SHIPPED');
await expect(async () => {
  /* several checks */
}).toPass({ timeout: 10_000 });
```

## Waiting for things that are not elements

```ts
const response = page.waitForResponse((r) => r.url().includes('/api/orders') && r.ok());
await page.getByRole('button', { name: 'Place order' }).click();
await response;

const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
const download = page.waitForEvent('download');
page.once('dialog', (d) => d.accept());
await page.waitForURL('**/inventory.html');
await page.waitForLoadState('networkidle'); // rarely needed; prefer a condition you can name
```

## Network

```ts
await page.route('**/api/products', (route) => route.fulfill({ json: [] }));
await page.route('**/*.{png,jpg}', (route) => route.abort());
await page.route('**/api/**', (route) =>
  route.continue({ headers: { ...route.request().headers(), 'x-test': '1' } }),
);
await page.routeFromHAR('fixtures/catalogue.har', { update: false });
const api = await request.newContext({ baseURL: 'https://restful-booker.herokuapp.com' });
const res = await api.post('/booking', { data: booking });
expect(res.status()).toBe(200);
```

## Context, state and emulation

```ts
test.use({ storageState: '.auth/standard.json' });
await context.storageState({ path: '.auth/standard.json', indexedDB: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
await context.addCookies([{ name: 'session', value: 'x', url: baseURL }]);
await page.clock.install({ time: new Date('2026-01-01T09:00:00') });
test.use({ ...devices['iPhone 15'], locale: 'de-DE', timezoneId: 'Europe/Berlin' });
test.use({ geolocation: { latitude: 13.08, longitude: 80.27 }, permissions: ['geolocation'] });
await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
```

## Test structure

```ts
import { test, expect } from '../../src/fixtures'; // never from @playwright/test in a spec

test.describe('checkout', { tag: '@smoke' }, () => {
  test('a buyer gets an order confirmation', async ({ inventoryPage, cartPage }) => {
    await test.step('add the backpack', async () => {
      /* ... */
    });
  });
});

test.skip(({ browserName }) => browserName !== 'chromium', 'CDP only');
test.fixme('known bug ABC-123');
test.slow();
test.describe.configure({ mode: 'parallel', retries: 1 });
```

Fixtures (`test.extend`) replace `beforeEach`: created only when a test asks for them, torn down even
when it fails, and `{ scope: 'worker' }` shares one per worker.

## Debugging

```ts
await page.pause(); // only behind PWDEBUG
await context.tracing.start({ screenshots: true, snapshots: true });
await context.tracing.startChunk();
/* ... */ await context.tracing.stopChunk({ path: 'part1.zip' });
page.on('console', (m) => console.log(m.type(), m.text()));
await testInfo.attach('state', { body: JSON.stringify(state), contentType: 'application/json' });
```
