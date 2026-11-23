// spec: specs/inventory.plan.md
// seed: tests/seed.spec.ts

import { ProductCard } from '../../src/components/product-card.component';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

test.describe('Main Happy Path', () => {
  test.beforeEach(async ({ loginFlow, inventoryPage }) => {
    // Seed: log in as standard_user and land on the inventory page.
    await loginFlow.loginAs('standard');
    await expect(inventoryPage.title).toHaveText('Products');
  });

  test('Main Happy Path', async ({ inventoryPage }) => {
    // 1. Click on the 'Sort products' combobox
    // 2. Select the 'Price (low to high)' option
    await inventoryPage.sortBy('lohi');
    await expect(inventoryPage.sort).toHaveValue('lohi');

    // 3. Verify that the products are sorted by price in ascending order
    // Compare against a sorted copy: two products share $15.99, so their relative order isn't fixed.
    await expect(inventoryPage.cards).toHaveCount(6);
    const prices = await inventoryPage.prices();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    // 4. Click on the 'Add to cart' button for the first product
    await expect(inventoryPage.header.cartBadge).toHaveCount(0);
    const first = new ProductCard(inventoryPage.cards.first());
    await expect(first.name).toHaveText('Sauce Labs Onesie');
    await first.addToCart.click();
    await expect(first.remove).toBeVisible();

    // 5. Verify that the cart badge displays the number '1'
    await expect(inventoryPage.header.cartBadge).toHaveText('1');
  });
});
