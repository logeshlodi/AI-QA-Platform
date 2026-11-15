import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

// A custom selector engine adds your own "prefix=value" syntax. Rarely needed
// now that getByTestId exists, but worth recognising in older suites.
test.beforeAll(async ({ playwright }) => {
  const engine = () => ({
    query: (root: Element | Document, value: string) => root.querySelector(`[data-test="${value}"]`),
    queryAll: (root: Element | Document, value: string) =>
      Array.from(root.querySelectorAll(`[data-test="${value}"]`)),
  });
  // Registration is per worker process and must happen before the page is created.
  await playwright.selectors.register('sauce', engine).catch(() => undefined);
});

test('selectors.register adds a custom engine', async ({ page }) => {
  await page.goto('/');
  await page.locator('sauce=username').fill('standard_user');
  await expect(page.locator('sauce=username')).toHaveValue('standard_user');
});
