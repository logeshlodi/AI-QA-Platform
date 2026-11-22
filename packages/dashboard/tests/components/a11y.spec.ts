import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { STORIES } from './stories';

// axe walks the whole story; on a busy laptop the first ones took 40 s with four workers.
test.describe.configure({ timeout: 90_000 });

// Every story, checked against WCAG 2.2 AA with axe. A new story is covered by adding its id to STORIES.
for (const story of STORIES) {
  test(`${story} has no WCAG 2.2 AA violations`, async ({ mount, page }) => {
    await mount(story);
    const results = await new AxeBuilder({ page })
      .include('#root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
}
