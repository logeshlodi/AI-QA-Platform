import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

test.describe('mouse and keyboard', () => {
  test('hover reveals hidden content', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/hovers'));
    const first = page.locator('.figure').first();
    await expect(first.getByText('name: user1')).toBeHidden();
    await first.hover();
    await expect(first.getByText('name: user1')).toBeVisible();
  });

  test('key presses reach the focused element', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/key_presses'));
    await page.locator('#target').press('A');
    await expect(page.locator('#result')).toHaveText('You entered: A');
    await page.keyboard.press('Shift');
    await expect(page.locator('#result')).toHaveText('You entered: SHIFT');
  });

  test('selects from a dropdown by label', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/dropdown'));
    await page.locator('#dropdown').selectOption({ label: 'Option 2' });
    await expect(page.locator('#dropdown')).toHaveValue('2');
  });
});
