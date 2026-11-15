import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

// Emulation is configured on the browser context, so it is set with test.use().
test.describe('geolocation and permissions', () => {
  test.use({
    targetName: 'theInternet',
    geolocation: { latitude: 13.0827, longitude: 80.2707 },
    permissions: ['geolocation'],
  });

  test('the page sees the coordinates we chose', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/geolocation'));
    await page.getByRole('button', { name: 'Where am I?' }).click();
    await expect(page.locator('#lat-value')).toHaveText('13.0827');
    await expect(page.locator('#long-value')).toHaveText('80.2707');
  });
});

test.describe('locale and timezone', () => {
  test.use({ locale: 'de-DE', timezoneId: 'Asia/Kolkata' });

  test('formatting follows the emulated locale and zone', async ({ page }) => {
    const seen = await page.evaluate(() => ({
      language: navigator.language,
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      number: (1234.5).toLocaleString(),
    }));
    expect(seen).toMatchObject({ language: 'de-DE', number: '1.234,5' });
    // Browsers report the same zone under either its current or its legacy name.
    expect(seen.zone).toMatch(/^Asia\/(Kolkata|Calcutta)$/);
  });
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('prefers-color-scheme reports dark', async ({ page }) => {
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
  });
});

test.describe('offline and clock', () => {
  test('offline mode makes navigation fail and navigator.onLine false', async ({ context, page }) => {
    await context.setOffline(true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(page.goto('https://demo.playwright.dev/todomvc/')).rejects.toThrow(
      /ERR_INTERNET_DISCONNECTED/,
    );
  });

  test('the clock can be frozen at a chosen instant', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-01T10:00:00Z'));
    expect(await page.evaluate(() => new Date().toISOString())).toBe('2026-01-01T10:00:00.000Z');
  });
});
