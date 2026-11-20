import { expect, test } from '@playwright/test';

// Lab 02: read README.md first. This spec has one planted mistake.

test('the dynamic-id button can be found and clicked on every visit', async ({ page }) => {
  // The day the test was written: copy the button's id from DevTools.
  await page.goto('http://www.uitestingplayground.com/dynamicid');
  const copiedId = await page.locator('button.btn-primary').getAttribute('id');

  // The day the test runs.
  await page.reload();
  const button = page.locator(`[id="${copiedId}"]`);
  await expect(button).toBeVisible({ timeout: 5_000 });
  await button.click();
});
