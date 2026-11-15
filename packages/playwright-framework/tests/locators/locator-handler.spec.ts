import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

// addLocatorHandler deals with overlays that appear at unpredictable moments
// (cookie banners, promos): Playwright runs the handler whenever the overlay
// blocks an action, then retries the action.
test('addLocatorHandler closes a modal that blocks a click', async ({ page }) => {
  await page.goto(targetUrl('theInternet', '/entry_ad'));
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();

  let handled = 0;
  await page.addLocatorHandler(modal, async () => {
    handled++;
    await modal.getByText('Close', { exact: true }).click();
  });

  await page.getByRole('heading', { name: 'Entry Ad' }).click();
  await expect(modal).toBeHidden();
  expect(handled).toBe(1);
});
