import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';
import { measureHeapGrowth, recordMetrics } from '../../src/perf';

// A leak check: an action that leaves the page as it found it should leave memory as it found it.
// After 20 warm-up rounds, 40 more rounds of adding a todo and deleting it again must not keep
// growing the JavaScript heap. Measured at 4.3 KB per round on 19 Nov 2026 (what is left of the
// warm-up), steady across runs; the budget is about twice that.
const MAX_GROWTH_PER_ROUND_BYTES = 8_192;

test.describe('memory', { tag: '@perf' }, () => {
  test.use({ targetName: 'todomvc' });

  test('adding and deleting a todo does not leak memory', async ({ page }, testInfo) => {
    await page.goto(targetUrl('todomvc', '/'));
    const input = page.getByPlaceholder('What needs to be done?');
    const todo = page.locator('.todo-list li');

    const growth = await measureHeapGrowth(page, async () => {
      await input.fill('temporary todo');
      await input.press('Enter');
      await todo.hover();
      await todo.getByRole('button', { name: 'Delete' }).click();
      await expect(todo).toHaveCount(0);
    });

    await recordMetrics(testInfo, { heap_growth_per_round_bytes: growth.perRoundBytes }, 'heap-growth');
    expect(growth.perRoundBytes).toBeLessThan(MAX_GROWTH_PER_ROUND_BYTES);
  });
});
