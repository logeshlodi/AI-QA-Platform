import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'todomvc' });

// An aria snapshot asserts the STRUCTURE a user perceives, in one readable block,
// instead of one assertion per element.
test('toMatchAriaSnapshot asserts a whole list at once', async ({ page }) => {
  await page.goto(targetUrl('todomvc', '/'));
  const input = page.getByPlaceholder('What needs to be done?');
  for (const todo of ['buy milk', 'write tests']) {
    await input.fill(todo);
    await input.press('Enter');
  }

  await expect(page.locator('.todo-list')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - checkbox "Toggle Todo"
        - text: buy milk
      - listitem:
        - checkbox "Toggle Todo"
        - text: write tests
  `);
});
