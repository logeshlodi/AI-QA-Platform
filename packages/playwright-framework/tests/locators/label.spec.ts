import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

// getByLabel finds a form field through its <label>, the way a person reads a form.
test('getByLabel fills a form by its visible labels', async ({ page }) => {
  await page.goto(targetUrl('theInternet', '/login'));
  await page.getByLabel('Username').fill('tomsmith');
  await page.getByLabel('Password').fill('SuperSecretPassword!');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('You logged into a secure area!')).toBeVisible();
});
