import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

// getByRole is the first choice: it finds elements the way assistive technology
// and users do, so it survives markup and styling changes.
test.describe('getByRole', () => {
  test('finds a heading by name and level', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/login'));
    await expect(page.getByRole('heading', { name: 'Login Page', level: 2 })).toBeVisible();
  });

  test('finds a button by its accessible name', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/login'));
    // This button draws an icon with a font glyph, and the glyph is part of its
    // accessible name. A substring or regex match is right here; { exact: true } is not.
    await expect(page.getByRole('button', { name: /login/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toHaveCount(0);
  });

  test('filters checkboxes by state', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/checkboxes'));
    await expect(page.getByRole('checkbox')).toHaveCount(2);
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(1);
    await page.getByRole('checkbox', { checked: false }).check();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(2);
  });
});
