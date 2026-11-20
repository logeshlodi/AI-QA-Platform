import { expect, test as base, type Page } from '@playwright/test';

// Lab 05, solved: no module-level state. A fixture gives every test its own logged-in page, and the
// product each test works with is known up front (the test's own data), not left behind by another test.

const test = base.extend<{ shop: Page }>({
  shop: async ({ page }, use) => {
    await page.goto('https://www.saucedemo.com/');
    await page.getByPlaceholder('Username').fill('standard_user');
    await page.getByPlaceholder('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();
    await use(page);
  },
});

test.describe.configure({ mode: 'parallel' });

const PRODUCT = 'Sauce Labs Backpack';

test('the catalogue lists the backpack first', async ({ shop }) => {
  await expect(shop.getByTestId('inventory-item-name').first()).toHaveText(PRODUCT);
});

test('adds the backpack to the cart', async ({ shop }) => {
  await shop
    .getByTestId('inventory-item')
    .filter({ hasText: PRODUCT })
    .getByRole('button', { name: 'Add to cart' })
    .click();
  await expect(shop.getByTestId('shopping-cart-badge')).toHaveText('1');
});
