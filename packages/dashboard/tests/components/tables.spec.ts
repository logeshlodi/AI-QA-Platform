import { expect, test } from '@playwright/test';

test.describe('RunTable', () => {
  test('lists runs newest first, links each one, and states its status in words', async ({ mount }) => {
    const component = await mount('RunTable/Recent');
    const table = component.getByRole('table', { name: 'Recent runs' });
    const rows = table.getByRole('row');
    await expect(rows).toHaveCount(6); // header + 5 runs
    const first = rows.nth(1);
    await expect(first.getByRole('rowheader')).toHaveText('22 Nov 2026, 09:30 UTC');
    await expect(first.getByRole('link')).toHaveAttribute('href', '/runs/r5');
    await expect(first.getByRole('cell').nth(2)).toHaveText('Failed');
    await expect(rows.nth(2).getByRole('cell').nth(2)).toHaveText('Passed');
    await expect(rows.nth(3).getByRole('cell').nth(2)).toHaveText('Flaky');
    await expect(first.getByRole('cell').last()).toHaveText('6 min 52 s');
  });

  test('says how to record a run when there are none', async ({ mount }) => {
    const component = await mount('RunTable/Empty');
    await expect(component.getByRole('table')).toHaveCount(0);
    await expect(component.getByRole('status')).toContainText('No runs recorded yet');
    await expect(component.getByRole('status')).toContainText('pnpm test:ui');
  });
});

test.describe('TestTable', () => {
  test('shows failures first, with the error', async ({ mount }) => {
    const component = await mount('TestTable/MixedRun');
    const items = component.getByRole('listitem');
    await expect(items).toHaveCount(5);
    await expect(items.first()).toContainText('Failed');
    await expect(items.first()).toContainText('checkout › completes an order with two items');
    await expect(items.first().locator('pre')).toContainText('Thank you for your order!');
    await expect(items.nth(1)).toContainText('Flaky');
    await expect(items.last()).toContainText('Skipped');
  });

  test('filters by status and counts each status', async ({ mount }) => {
    const component = await mount('TestTable/MixedRun');
    const filter = component.getByRole('group', { name: 'Show tests' });
    await expect(filter.getByRole('radio', { name: 'All (5)' })).toBeChecked();
    await filter.getByText('Flaky (1)').click();
    await expect(filter.getByRole('radio', { name: 'Flaky (1)' })).toBeChecked();
    await expect(component.getByRole('listitem')).toHaveCount(1);
    await expect(component.getByRole('listitem')).toContainText('inventory › sorts by price');
    await filter.getByText('Passed (2)').click();
    await expect(component.getByRole('listitem')).toHaveCount(2);
  });

  test('works from the keyboard', async ({ mount, page }) => {
    const component = await mount('TestTable/MixedRun');
    await component.getByRole('radio', { name: 'All (5)' }).focus();
    await page.keyboard.press('ArrowRight'); // radios in a group move with the arrow keys
    await expect(component.getByRole('radio', { name: 'Failed (1)' })).toBeChecked();
    await expect(component.getByRole('listitem')).toHaveCount(1);
  });

  test('says so when no test has the chosen status', async ({ mount }) => {
    const component = await mount('TestTable/AllPassed');
    await component.getByText('Failed (0)').click();
    await expect(component.getByRole('status')).toHaveText('No tests with this status');
  });
});

test.describe('FlakyTable, HealTable, AgentRunTable', () => {
  test('flaky tests are ranked by how often they flipped', async ({ mount }) => {
    const component = await mount('FlakyTable/Some');
    const rows = component.getByRole('row');
    await expect(rows.nth(1).getByRole('rowheader')).toHaveText('inventory › sorts by price, low to high');
    await expect(rows.nth(1)).toContainText('3 of 10');
    await expect(rows.nth(1)).toContainText('30%');
  });

  test('the heal audit shows what replaced each locator, and when nothing did', async ({ mount }) => {
    const component = await mount('HealTable/Mixed');
    const rows = component.getByRole('row');
    await expect(rows.nth(1)).toContainText("getByRole('button', { name: 'Pay now' })");
    await expect(rows.nth(1)).toContainText('Healed');
    await expect(rows.nth(1)).toContainText('Patch proposed for pages/checkout.page.ts');
    await expect(rows.nth(3).getByRole('cell').nth(2)).toHaveText('—');
    await expect(rows.nth(3)).toContainText('Not healed');
  });

  test('agent runs say whether the model or the rules answered, and why it fell back', async ({ mount }) => {
    const component = await mount('AgentRunTable/Mixed');
    const rows = component.getByRole('row');
    await expect(rows.nth(1)).toContainText('Model');
    await expect(rows.nth(2)).toContainText('Rules (fallback)');
    await expect(rows.nth(2)).toContainText('aborted due to timeout');
    await expect(rows.nth(2)).toContainText('15 min 0 s');
  });

  test('empty audit and log explain themselves', async ({ mount }) => {
    await expect((await mount('HealTable/None')).getByRole('status')).toContainText('No heals recorded');
    await expect((await mount('AgentRunTable/None')).getByRole('status')).toContainText(
      'pnpm aiqa agents triage',
    );
    await expect((await mount('FlakyTable/None')).getByRole('status')).toContainText('No flaky tests');
  });
});
