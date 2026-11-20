import { expect, test } from '@playwright/test';

// Lab 04, solved: every web-first assertion awaited, and the test now states what really happens.

test('a locked-out user is refused at the login page', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill('locked_out_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByTestId('error')).toHaveText('Epic sadface: Sorry, this user has been locked out.');
  await expect(page).not.toHaveURL(/inventory\.html/);
});
