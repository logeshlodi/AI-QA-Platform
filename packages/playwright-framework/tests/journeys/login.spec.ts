import { expect, test } from '../../src/fixtures';
import { sauceUsers } from '../../src/data/users';

test.use({ targetName: 'saucedemo' });

// Data-driven: one test body, one generated test per row.
const invalidLogins = [
  // review-ok: SauceDemo's published demo password, inside the table of cases
  { name: 'no username', username: '', password: 'secret_sauce', message: 'Username is required' },
  { name: 'no password', username: sauceUsers.standard, password: '', message: 'Password is required' },
  {
    name: 'wrong password',
    username: sauceUsers.standard,
    password: 'wrong',
    message: 'Username and password do not match',
  },
];

test.describe('Login', { tag: '@journey' }, () => {
  for (const row of invalidLogins) {
    test(`rejects a login with ${row.name}`, async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login(row.username, row.password);
      await expect(loginPage.error).toContainText(row.message);
    });
  }

  test('logging out returns to the login form', async ({ loginFlow, inventoryPage, loginPage, page }) => {
    await loginFlow.loginAs('standard');
    await inventoryPage.header.logout();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(page).toHaveURL(/saucedemo\.com\/?$/);
  });
});
