import { expect, test } from '../../src/fixtures';

/**
 * Layout selectors pick an element by where it sits relative to another one.
 * They are LEGACY: Playwright's docs mark them deprecated, and they break when the
 * layout shifts by a few pixels. They are here so you can read them in older suites.
 * In new code, scope with a locator and filter instead (see chaining-within.spec.ts and filter.spec.ts).
 */
const FORM = `
  <style>
    .row { display: flex; gap: 12px; margin: 16px; align-items: center; }
    label, span { width: 120px; }
  </style>
  <div class="row"><span>Username</span><input id="user" /></div>
  <div class="row"><span>Password</span><input id="pass" type="password" /></div>
  <div class="row"><span></span><button id="go">Sign in</button><button id="cancel">Cancel</button></div>`;

test.describe('legacy layout selectors', { tag: '@legacy' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(FORM);
  });

  test(':right-of and :left-of', async ({ page }) => {
    await page.locator('input:right-of(:text("Password"))').first().fill('secret');
    await expect(page.locator('#pass')).toHaveValue('secret');
    await expect(page.locator('button:left-of(#cancel)').first()).toHaveText('Sign in');
  });

  test(':below and :above', async ({ page }) => {
    await expect(page.locator('input:below(#user)').first()).toHaveAttribute('id', 'pass');
    await expect(page.locator('input:above(#pass)').first()).toHaveAttribute('id', 'user');
  });

  test(':near takes a distance in pixels', async ({ page }) => {
    await expect(page.locator('button:near(#cancel, 80)').first()).toHaveText('Sign in');
    await expect(page.locator('input:near(#cancel, 5)')).toHaveCount(0);
  });

  test('the modern equivalent needs no coordinates', async ({ page }) => {
    const row = page.locator('.row').filter({ hasText: 'Password' });
    await row.locator('input').fill('secret');
    await expect(page.locator('#pass')).toHaveValue('secret');
  });
});
