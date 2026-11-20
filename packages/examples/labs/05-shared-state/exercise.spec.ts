import { expect, test } from '@playwright/test';

// Lab 05: read README.md first. This spec has one planted mistake.

test.describe.configure({ mode: 'parallel' });

let productName: string | null = null;

test('reads the name of the first product', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  productName = await page.getByTestId('inventory-item-name').first().textContent();
  expect(productName).toBeTruthy();
});

test('adds that product to the cart', async ({ page }) => {
  expect(productName, 'set by the previous test').not.toBeNull();
  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await page
    .getByTestId('inventory-item')
    .filter({ hasText: productName! })
    .getByRole('button', { name: 'Add to cart' })
    .click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});
