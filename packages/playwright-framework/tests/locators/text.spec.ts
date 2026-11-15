import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'uiPlayground' });

test.describe('getByText', () => {
  test('ignores the extra whitespace that defeats an XPath text() match', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/verifytext'));
    await expect(page.locator('.bg-primary').getByText('Welcome UserName!')).toBeVisible();
  });

  test('exact and regex matching narrow a substring match', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/'));
    await expect(page.getByText('Dynamic ID', { exact: true })).toHaveCount(1);
    await expect(page.getByText(/^Class Attribute$/)).toHaveCount(1);
  });

  test('treats a non-breaking space as a space', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/nbsp'));
    await expect(page.getByRole('button', { name: 'My Button' })).toBeVisible();
  });
});
