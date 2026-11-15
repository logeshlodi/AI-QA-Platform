import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

// describe() names a locator. The name replaces the raw selector in traces,
// reports and error messages, which is why every page-object locator has one.
test('describe() gives a locator a readable name', async ({ loginPage }) => {
  await loginPage.goto();
  expect(loginPage.loginButton.description()).toBe('Login button');
  expect(loginPage.username.description()).toBe('Username field');
  await expect(loginPage.loginButton).toBeVisible();
});
