import { expect, test } from '../../src/fixtures';
import { SAUCE_AUTH_FILE } from '../../src/paths';

test.use({ targetName: 'saucedemo', storageState: SAUCE_AUTH_FILE });

// CSS is fine for stable, meaningful hooks. It is brittle when it encodes layout
// (div > div:nth-child(3)) or generated class names.
test('CSS selectors: class, attribute and combinators', async ({ page }) => {
  await page.goto('/inventory.html');
  await expect(page.locator('.inventory_item')).toHaveCount(6);
  await expect(page.locator('button[data-test^="add-to-cart"]')).toHaveCount(6);
  await expect(page.locator('.inventory_item:has-text("Onesie") .inventory_item_price')).toHaveText('$7.99');
});
