import { expect, test } from '@playwright/test';

// Lab 04: read README.md first. This spec has one planted mistake and a wrong claim to go with it.

test('a locked-out user reaches the products page', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill('locked_out_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  expect(page).toHaveURL(/inventory\.html/);
});
