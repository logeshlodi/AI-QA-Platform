import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * Web notifications. Playwright's default headless Chromium is the lightweight "headless shell",
 * which has no notification support (permission always "denied"), so this file asks for the full
 * Chromium build in its new headless mode. A launch setting, hence a file of its own. Not with a
 * shared browser server (PW_WS_ENDPOINT), whose own build applies.
 */
test.use({ channel: 'chromium' });
test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium permission names');
test.skip(Boolean(process.env.PW_WS_ENDPOINT), 'launch settings do not reach a shared browser server');

test.describe('notifications', () => {
  // A headless browser shows nothing on screen, so the page's notifications are recorded instead.
  const RECORD = () => {
    const shown: { title: string; body?: string }[] = [];
    (window as unknown as { shown: typeof shown }).shown = shown;
    const Real = window.Notification;
    class Recorded extends Real {
      constructor(title: string, options?: NotificationOptions) {
        super(title, options);
        shown.push({ title, body: options?.body });
      }
    }
    window.Notification = Recorded as typeof Notification;
  };
  const PAGE = html(
    'Orders',
    `<button onclick="
       Notification.requestPermission().then((p) => {
         if (p === 'granted') new Notification('Order confirmed', { body: 'Order 42 is on its way' });
         else document.getElementById('fallback').textContent = 'Turn on notifications to hear about your order';
       })">Notify me</button>
     <p id="fallback" role="status"></p>`,
  );

  test('granted: the page shows a notification with the order', async ({ page, context }) => {
    await context.grantPermissions(['notifications'], { origin: LOCAL_ORIGIN });
    await page.addInitScript(RECORD);
    await serveLocal(page, { '/': PAGE });
    await page.goto(`${LOCAL_ORIGIN}/`);

    expect(await page.evaluate(() => Notification.permission)).toBe('granted');
    await page.getByRole('button', { name: 'Notify me' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { shown: unknown[] }).shown))
      .toEqual([{ title: 'Order confirmed', body: 'Order 42 is on its way' }]);
  });

  test('not granted: the page falls back to a message on screen', async ({ page }) => {
    await page.addInitScript(RECORD);
    await serveLocal(page, { '/': PAGE });
    await page.goto(`${LOCAL_ORIGIN}/`);

    await page.getByRole('button', { name: 'Notify me' }).click();
    await expect(page.getByRole('status')).toHaveText('Turn on notifications to hear about your order');
    expect(await page.evaluate(() => (window as unknown as { shown: unknown[] }).shown)).toEqual([]);
  });
});
