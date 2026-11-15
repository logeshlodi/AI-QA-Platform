import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'uiPlayground' });

// What Playwright means by "visible": a non-empty box and no visibility:hidden.
// Opacity and being covered by another element do NOT make an element hidden.
test('visibility rules, shown on eight ways to hide a button', async ({ page }) => {
  await page.goto(targetUrl('uiPlayground', '/visibility'));
  await page.getByRole('button', { name: 'Hide' }).click();

  await expect(page.locator('#removedButton')).toHaveCount(0);
  await expect(page.locator('#zeroWidthButton')).toBeHidden();
  await expect(page.locator('#invisibleButton')).toBeHidden();
  await expect(page.locator('#notdisplayedButton')).toBeHidden();
  await expect(page.locator('#transparentButton')).toBeVisible();
  await expect(page.locator('#overlappedButton')).toBeVisible();

  // filter({ visible }) and locator.visible() (Playwright 1.63+) keep only what a user can see.
  const all = page.locator('table button');
  const shown = await all.filter({ visible: true }).count();
  expect(shown).toBeLessThan(await all.count());
  expect(await all.visible().count()).toBe(shown);
});
