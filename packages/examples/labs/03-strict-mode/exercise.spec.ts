import { expect, test } from '@playwright/test';

// Lab 03: read README.md first. This spec has one planted mistake.

test('adds the Bike Light to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  // Failed with "strict mode violation: resolved to 6 elements", so: .first().
  await page.getByRole('button', { name: 'Add to cart' }).first().click();

  await page.getByTestId('shopping-cart-link').click();
  await expect(page.getByTestId('inventory-item-name')).toHaveText(['Sauce Labs Bike Light']);
});
