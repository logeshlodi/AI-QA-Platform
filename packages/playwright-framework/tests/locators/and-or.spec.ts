import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

test.describe('combining locators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/dynamic_controls'));
  });

  test('or() waits for whichever of two outcomes appears', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText("It's gone!").or(page.getByText("It's back!"))).toBeVisible({
      timeout: 15_000,
    });
  });

  test('and() requires one element to satisfy both locators', async ({ page }) => {
    await expect(page.getByRole('button').and(page.getByText('Enable'))).toHaveCount(1);
  });
});
