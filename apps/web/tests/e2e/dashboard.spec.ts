import { expect, test } from '@playwright/test';

// Signed in as the viewer (the sign-in project), on the fixture data set (tests/fixtures/seed.ts).

test('the overview shows the latest run of each suite and the counts that need a look', async ({ page }) => {
  await page.goto('/');
  const tiles = page.getByRole('region', { name: 'Latest run of each suite' });
  await expect(tiles).toContainText('api: pass rate100%0 failed · 0 flaky · 3 tests');
  await expect(tiles).toContainText('ui: pass rate80%1 failed · 1 flaky · 6 tests');
  await expect(tiles).toContainText('Flaky tests1');
  await expect(tiles).toContainText('Heals recorded2');
  await expect(tiles).toContainText('33.3%');
  await expect(page.getByRole('figure')).toContainText('Pass rate, ui suite');
  await expect(page.getByRole('table', { name: 'Latest runs' }).getByRole('row')).toHaveCount(11);
});

test('from the runs list to one run, and its failing test with the error', async ({ page }) => {
  await page.goto('/runs');
  const table = page.getByRole('table', { name: 'All runs' });
  await expect(table.getByRole('row')).toHaveCount(13); // header + 12 runs
  await page
    .getByRole('navigation', { name: 'Suite' })
    .getByRole('link', { name: 'ui', exact: true })
    .click();
  await expect(page).toHaveURL('/runs?suite=ui');
  await expect(page.getByRole('table', { name: 'Runs of the ui suite' }).getByRole('row')).toHaveCount(9);
  await page.getByRole('link', { name: '20 Nov 2026, 09:00 UTC' }).click();
  await expect(page).toHaveURL('/runs/ui-08');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ui run, 20 Nov 2026, 09:00 UTC');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Runs', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByText('Failed (1)').click();
  const failed = page
    .getByRole('listitem')
    .filter({ hasText: 'checkout › completes an order with two items' });
  await expect(failed).toContainText('1 retry');
  await expect(failed.locator('pre')).toContainText('Thank you for your order!');
});

test('trends switch between suites', async ({ page }) => {
  await page.goto('/trends');
  await expect(page.getByRole('img', { name: /Pass rate, ui suite/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Duration, ui suite/ })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Suite' })
    .getByRole('link', { name: 'api', exact: true })
    .click();
  await expect(page.getByRole('figure').first()).toContainText('Latest 100% (22 Nov 08:30)');
  await page.getByText('Show as a table').first().click();
  await expect(page.getByRole('figure').first().getByRole('row')).toHaveCount(5);
});

test('flaky tests, heal audit and agent runs come from their own stores', async ({ page }) => {
  await page.goto('/flaky');
  const flaky = page.getByRole('table', { name: 'Flaky tests, worst first' });
  await expect(flaky.getByRole('row')).toHaveCount(2);
  await expect(flaky).toContainText('inventory › sorts by price, low to high');
  await expect(flaky).toContainText('3 of 8');

  await page.getByRole('link', { name: 'Heal audit' }).click();
  const heals = page.getByRole('table', { name: 'Heal audit, newest first' });
  await expect(heals.getByRole('row').nth(1)).toContainText("page.getByRole('button', { name: 'Finish' })");
  await expect(heals.getByRole('row').nth(1)).toContainText('Healed');
  await expect(heals.getByRole('row').nth(2)).toContainText('Not healed');

  await page.getByRole('link', { name: 'Agent runs' }).click();
  const agents = page.getByRole('table', { name: 'Agent runs, newest first' });
  await expect(agents.getByRole('row').nth(1)).toContainText('api-tester');
  await expect(agents.getByRole('row').nth(1)).toContainText('aborted due to timeout');
  await expect(agents.getByRole('row').nth(2)).toContainText('Model');
});

test('an unknown run is a 404 page with a way back', async ({ page }) => {
  const response = await page.goto('/runs/no-such-run');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'All runs' })).toBeVisible();
});
