import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

test.describe('Main Happy Path', () => {
  test.beforeEach(async ({ loginFlow }) => {
    await loginFlow.loginAs('standard');
  });

  test('sort products by price and add to cart', async ({ inventoryPage }) => {
    await test.step('sort products by price (low to high)', async () => {
      await inventoryPage.sortBy('lohi');
      const prices = await inventoryPage.prices();
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(prices).toHaveLength(6);
    });

    await test.step('add the first product to the cart', async () => {
      await inventoryPage.addToCart('Sauce Labs Backpack');
      await expect(inventoryPage.header.cartBadge).toHaveText('1');
    });
  });
});
