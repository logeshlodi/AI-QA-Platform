import { expect, test } from '../../src/fixtures';

// A hybrid screen: the demo app's Webview tab shows a web page inside the native app. Native
// commands see one opaque view; switching to the WEBVIEW context hands the same session to
// Chromedriver, which sees the page's DOM. Switching back returns to native commands.

test.describe('The web page inside the app', { tag: ['@mobile', '@android', '@web'] }, () => {
  test.afterEach(async ({ driver }) => {
    await driver.switchContext('NATIVE_APP');
  });

  test('the app shows a web page, whose content is reachable in the web context', async ({
    screens,
    driver,
  }) => {
    await screens.nav.open('Webview');
    // The WebView appears as a context once its page has started loading.
    await expect
      .poll(async () => (await driver.getContexts()).map(String).some((c) => c.startsWith('WEBVIEW_')), {
        timeout: 30_000,
      })
      .toBe(true);
    const webview = (await driver.getContexts()).map(String).find((c) => c.startsWith('WEBVIEW_'))!;

    await driver.switchContext(webview);
    await expect.poll(() => driver.getUrl(), { timeout: 30_000 }).toContain('webdriver.io');
    await expect.poll(() => driver.execute(() => document.querySelectorAll('a').length)).toBeGreaterThan(5);

    await driver.switchContext('NATIVE_APP');
    expect(await driver.getContext()).toBe('NATIVE_APP');
    await screens.nav.open('Home');
    await screens.home.waitUntilShown();
  });
});
