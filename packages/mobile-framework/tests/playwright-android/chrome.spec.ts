import { _android as android, expect, test } from '@playwright/test';
import { mobileConfig } from '../../src/config';
import { reversePort, startTestSite } from '../../src/web';

// The same page and checks as tests/web/chrome.spec.ts, through Playwright's own (experimental)
// Android support instead of Appium: Playwright talks to Chrome on the device directly, so the
// test gets Playwright's locators, auto-waiting and web-first assertions. It cannot do native
// gestures or apps; that is what Appium is for.
//
// Chrome reads Playwright's command line only when it is the "debug app" on a device that is not
// rooted (the Google Play images are not), so the test sets that first.

test.describe(
  'The same page through Playwright for Android',
  { tag: ['@mobile', '@android', '@web'] },
  () => {
    test('the order form answers, with Playwright locators and assertions', async () => {
      const [device] = await android.devices();
      test.skip(!device, 'No Android device or emulator is running');
      const site = await startTestSite();
      const undo = reversePort(site.port, mobileConfig().udid);
      try {
        await device!.shell('am set-debug-app --persistent com.android.chrome');
        await device!.shell('am force-stop com.android.chrome');
        const context = await device!.launchBrowser();
        const page = await context.newPage();
        await page.goto(site.url);

        await page.getByLabel('Order number').fill('1042');
        await page.getByRole('button', { name: 'Find order' }).click();
        await expect(page.getByRole('status')).toHaveText('Order 1042 is on its way.');

        await context.close();
      } finally {
        undo();
        await site.close();
        await device?.close();
      }
    });
  },
);
