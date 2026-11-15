import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

// A test id is a contract with developers: stable, but only if the team maintains it.
test.describe('getByTestId on SauceDemo (data-test, set in playwright.config.ts)', () => {
  test.use({ targetName: 'saucedemo' });

  test('reads the attribute configured as testIdAttribute', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('username').fill('standard_user');
    await expect(page.getByTestId('login-button')).toHaveValue('Login');
  });
});

test.describe('getByTestId on TodoMVC (data-testid, overridden for this block)', () => {
  test.use({ targetName: 'todomvc', testIdAttribute: 'data-testid' });

  test('the same call follows the per-suite override', async ({ page }) => {
    await page.goto(targetUrl('todomvc', '/'));
    await page.getByPlaceholder('What needs to be done?').fill('write a locator spec');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('todo-title')).toHaveText('write a locator spec');
  });
});
