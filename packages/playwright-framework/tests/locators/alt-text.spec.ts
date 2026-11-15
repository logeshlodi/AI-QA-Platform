import { expect, test } from '../../src/fixtures';
import { SAUCE_AUTH_FILE } from '../../src/paths';

test.use({ targetName: 'saucedemo', storageState: SAUCE_AUTH_FILE });

test('getByAltText finds an image by its text alternative', async ({ page }) => {
  await page.goto('/inventory.html');
  const image = page.getByAltText('Sauce Labs Backpack');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', /\.jpg$/);
});
