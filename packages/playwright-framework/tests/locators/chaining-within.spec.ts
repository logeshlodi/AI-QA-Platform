import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

test.describe('scoping a locator to a region', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/tables'));
  });

  test('chaining searches inside the previous match', async ({ page }) => {
    const table = page.locator('#table1');
    await expect(table.getByRole('row').filter({ hasText: 'Bach' }).getByRole('cell').nth(3)).toHaveText(
      '$51.00',
    );
  });

  // locator.within() arrived in Playwright 1.64: "this, inside each of those".
  test('within() picks one column across every row', async ({ page }) => {
    const lastNames = page.getByRole('cell').first().within(page.locator('#table1 tbody tr'));
    await expect(lastNames).toHaveText(['Smith', 'Bach', 'Doe', 'Conway']);
  });
});
