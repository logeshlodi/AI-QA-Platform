import { expect, test } from '@playwright/test';

// Lab 01, solved: no sleep. The web-first assertion retries until the text is there or its own
// timeout runs out, so the test takes as long as the page does, and no longer.

test('shows the result the page calculates on the client', async ({ page }) => {
  test.slow(); // this page is slow on purpose: triple the test timeout, for this test only
  await page.goto('http://www.uitestingplayground.com/clientdelay');
  await page.getByRole('button', { name: 'Button Triggering Client Side Logic' }).click();

  await expect(page.locator('.bg-success')).toHaveText('Data calculated on the client side.', {
    timeout: 25_000,
  });
});
