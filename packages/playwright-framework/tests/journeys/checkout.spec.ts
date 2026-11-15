import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

test.describe('Checkout', { tag: '@journey' }, () => {
  test.beforeEach(async ({ loginFlow }) => {
    await loginFlow.loginAs('standard');
  });

  test('a customer buys two products', async ({ checkoutFlow, checkoutPage, inventoryPage }) => {
    await test.step('add products and reach the overview', async () => {
      await checkoutFlow.toOverview(['Sauce Labs Backpack', 'Sauce Labs Bike Light']);
    });
    await test.step('the subtotal is the sum of both prices', async () => {
      await expect(checkoutPage.subtotal).toHaveText('Item total: $39.98');
    });
    await test.step('finish the order', async () => {
      await checkoutPage.finishButton.click();
      await expect(checkoutPage.completeHeader).toHaveText('Thank you for your order!');
      await expect(inventoryPage.header.cartBadge).toBeHidden();
    });
  });

  test('the cart badge counts added products', async ({ inventoryPage }) => {
    await inventoryPage.addToCart('Sauce Labs Backpack');
    await inventoryPage.addToCart('Sauce Labs Onesie');
    await expect(inventoryPage.header.cartBadge).toHaveText('2');
    await inventoryPage.card('Sauce Labs Onesie').remove.click();
    await expect(inventoryPage.header.cartBadge).toHaveText('1');
  });

  test('checkout needs a first name', async ({ checkoutFlow, checkoutPage }) => {
    await checkoutFlow.toOverview(['Sauce Labs Backpack'], {
      firstName: '',
      lastName: 'Tester',
      postalCode: '600001',
    });
    await expect(checkoutPage.error).toContainText('First Name is required');
  });

  test('products sort by price, low to high', async ({ inventoryPage }) => {
    await inventoryPage.sortBy('lohi');
    const prices = await inventoryPage.prices();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices).toHaveLength(6);
  });
});
