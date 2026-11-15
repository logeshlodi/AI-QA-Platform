import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

// XPath is the last resort. It can walk UP the tree, which CSS cannot, but it is
// tied to document structure and does not pierce shadow DOM.
test('XPath finds a row by a cell value, then a link inside that row', async ({ page }) => {
  await page.goto(targetUrl('theInternet', '/challenging_dom'));
  const row = page.locator('xpath=//table/tbody/tr[td[normalize-space()="Apeirian3"]]');
  await expect(row.locator('xpath=./td[1]')).toHaveText('Iuvaret3');
  await expect(row.locator('xpath=.//a[normalize-space()="edit"]')).toBeVisible();

  // The same thing without XPath, and easier to read:
  await expect(
    page.getByRole('row').filter({ hasText: 'Apeirian3' }).getByRole('link', { name: 'edit' }),
  ).toBeVisible();
});
