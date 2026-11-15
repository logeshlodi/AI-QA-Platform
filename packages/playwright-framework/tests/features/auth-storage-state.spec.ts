import { expect, test } from '../../src/fixtures';
import { SAUCE_AUTH_FILE } from '../../src/paths';

test.describe('reusing a saved login (storageState)', () => {
  test.use({ targetName: 'saucedemo', storageState: SAUCE_AUTH_FILE });

  test('starts already logged in, with no login step', async ({ page, inventoryPage }) => {
    await page.goto('/inventory.html');
    await expect(inventoryPage.title).toHaveText('Products');
  });
});

test.describe('injecting the session cookie directly', () => {
  test.use({ targetName: 'saucedemo' });

  test('a cookie set before navigation is enough to be logged in', async ({
    context,
    page,
    baseURL,
    inventoryPage,
  }) => {
    await context.addCookies([{ name: 'session-username', value: 'standard_user', url: baseURL! }]);
    await page.goto('/inventory.html');
    await expect(inventoryPage.cards).toHaveCount(6);
  });
});
