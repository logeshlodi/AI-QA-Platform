import { expect, test } from '@playwright/test';

// Lab 03, solved: find the product's card by its name, then the button inside that card.

test('adds the Bike Light to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  const bikeLight = page.getByTestId('inventory-item').filter({ hasText: 'Sauce Labs Bike Light' });
  await bikeLight.getByRole('button', { name: 'Add to cart' }).click();

  await page.getByTestId('shopping-cart-link').click();
  await expect(page.getByTestId('inventory-item-name')).toHaveText(['Sauce Labs Bike Light']);
});
