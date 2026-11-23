import { expect, test } from './fixtures';

// SauceDemo's published demo accounts.
const PASSWORD = 'secret_sauce';

test.describe('sign-in', () => {
  test('a standard user sees the products @smoke', async ({ loginPage, inventoryPage }) => {
    await loginPage.open();
    await loginPage.signIn('standard_user', PASSWORD);
    await expect(inventoryPage.title).toHaveText('Products');
    await expect(inventoryPage.items).toHaveCount(6);
  });

  test('a locked-out user is refused with a reason @smoke', async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.signIn('locked_out_user', PASSWORD);
    await expect(loginPage.error).toContainText('this user has been locked out');
  });
});

test('adding a product shows it in the cart badge', async ({ loginPage, inventoryPage }) => {
  await loginPage.open();
  await loginPage.signIn('standard_user', PASSWORD);
  await inventoryPage.addToCart('Sauce Labs Backpack');
  await expect(inventoryPage.cartBadge).toHaveText('1');
});
