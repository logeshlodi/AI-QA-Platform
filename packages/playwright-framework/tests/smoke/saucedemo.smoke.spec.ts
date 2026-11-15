import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

// The gate for every browser and device project: is the app usable at all?
test.describe('SauceDemo smoke', { tag: '@smoke' }, () => {
  test('a standard user logs in and sees six products', async ({ loginFlow, inventoryPage }) => {
    await loginFlow.loginAs('standard');
    await expect(inventoryPage.title).toHaveText('Products');
    await expect(inventoryPage.cards).toHaveCount(6);
  });

  test('a locked-out user is told why', async ({ loginFlow, loginPage }) => {
    await loginFlow.loginAs('lockedOut');
    await expect(loginPage.error).toContainText('Sorry, this user has been locked out.');
  });
});
