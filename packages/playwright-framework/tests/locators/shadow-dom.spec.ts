import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'uiPlayground' });

test('CSS and getBy locators pierce open shadow roots; XPath does not', async ({ page }) => {
  await page.goto(targetUrl('uiPlayground', '/shadowdom'));

  await page.locator('#buttonGenerate').click();
  await expect(page.locator('#editField')).toHaveValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );

  // review-ok: proves XPath cannot see inside a shadow root
  await expect(page.locator('xpath=//*[@id="buttonGenerate"]')).toHaveCount(0);
});
