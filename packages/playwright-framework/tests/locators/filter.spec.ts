import { expect, test } from '../../src/fixtures';
import { SAUCE_AUTH_FILE } from '../../src/paths';

test.use({ targetName: 'saucedemo', storageState: SAUCE_AUTH_FILE });

test.describe('locator.filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory.html');
  });

  test('hasText and hasNotText narrow a list by content', async ({ inventoryPage }) => {
    await expect(inventoryPage.cards.filter({ hasText: 'Sauce Labs Backpack' })).toHaveCount(1);
    await expect(inventoryPage.cards.filter({ hasNotText: 'Sauce Labs Backpack' })).toHaveCount(5);
  });

  test('has and hasNot narrow a list by what each item contains', async ({ inventoryPage, page }) => {
    const removeButton = page.getByRole('button', { name: 'Remove' });
    await inventoryPage.addToCart('Sauce Labs Bike Light');
    await expect(inventoryPage.cards.filter({ has: removeButton })).toHaveCount(1);
    await expect(inventoryPage.cards.filter({ hasNot: removeButton })).toHaveCount(5);
    await expect(
      inventoryPage.cards.filter({ has: removeButton }).getByTestId('inventory-item-name'),
    ).toHaveText('Sauce Labs Bike Light');
  });
});
