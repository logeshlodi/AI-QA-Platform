import { expect, test } from '@playwright/test';

// Lab 01: read README.md first. This spec has one planted mistake.

test('shows the result the page calculates on the client', async ({ page }) => {
  await page.goto('http://www.uitestingplayground.com/clientdelay');
  await page.getByRole('button', { name: 'Button Triggering Client Side Logic' }).click();

  // "The calculation takes a moment, so give it a few seconds."
  // review-ok: the lab's broken version; the solution replaces this wait
  await page.waitForTimeout(3_000);
  const message = await page.locator('.bg-success').textContent({ timeout: 1_000 });
  expect(message).toBe('Data calculated on the client side.');
});
