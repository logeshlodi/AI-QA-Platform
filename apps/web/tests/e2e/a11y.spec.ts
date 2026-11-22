import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// axe walks the whole page; with four workers on a busy laptop the first pages took 30 to 40 s.
test.describe.configure({ timeout: 90_000 });

const PAGES = ['/', '/runs', '/runs/ui-08', '/trends', '/flaky', '/heals', '/agents', '/runs/no-such-run'];

for (const path of PAGES) {
  test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
}

test('/signed-out has no WCAG 2.2 AA violations', async ({ browser }) => {
  const context = await browser.newContext(); // no session: the page anyone sees after signing out
  const page = await context.newPage();
  await page.goto('/signed-out?error=sign-in-failed');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await context.close();
});

test('the run page works from the keyboard alone', async ({ page }) => {
  await page.goto('/runs/ui-08');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
