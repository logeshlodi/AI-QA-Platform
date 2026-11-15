import { expect, test } from '../../src/fixtures';

// No demo target offers a stable title attribute, so this one spec uses a local page.
test('getByTitle finds an element by its title attribute', async ({ page }) => {
  await page.setContent(
    '<span title="Issues count">25 issues</span><abbr title="Page Object Model">POM</abbr>',
  );
  await expect(page.getByTitle('Issues count')).toHaveText('25 issues');
  await expect(page.getByTitle('Page Object Model')).toHaveText('POM');
});
