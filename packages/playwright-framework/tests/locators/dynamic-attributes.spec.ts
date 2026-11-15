import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'uiPlayground' });

// Why id and class locators rot, and what to use instead. These pages are also
// the seeds for the self-healing specs in tests/healing.
test.describe('dynamic attributes', () => {
  test('an id that changes on every load breaks an id locator; role and name survive', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/dynamicid'));
    const button = page.getByRole('button', { name: 'Button with Dynamic ID' });
    const firstId = await button.getAttribute('id');

    await page.reload();
    await expect(button).toBeVisible();
    await expect(button).not.toHaveAttribute('id', firstId ?? '');
    await expect(page.locator(`[id="${firstId}"]`)).toHaveCount(0);
  });

  test('match one class token, never the whole class string', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/classattr'));
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    await page.locator('button.btn-primary').click();
    expect(dialogs).toEqual(['Primary button pressed']);
  });
});
