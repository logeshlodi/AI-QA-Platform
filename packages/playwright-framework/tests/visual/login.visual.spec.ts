import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo', viewport: { width: 1280, height: 720 } });

/**
 * Visual comparison with Playwright's built-in engine (no paid service).
 * Baselines are per browser and operating system, and live next to this file.
 * Create or refresh them with:  pnpm --filter @aiqa/playwright-framework snapshots:update
 */
test('the login form looks the same as its baseline', async ({ loginPage, page }) => {
  await loginPage.goto();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.login_wrapper-inner')).toHaveScreenshot('login-form.png', {
    animations: 'disabled',
  });
});
