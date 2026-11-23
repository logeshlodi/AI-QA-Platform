import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'uiPlayground' });

// Playwright waits for an element to be attached, visible, stable, enabled and
// able to receive events before acting. These pages each break one naive assumption.
test.describe('auto-waiting', () => {
  test('waits for a slow page to finish loading', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/loaddelay'));
    const button = page.getByRole('button', { name: 'Button Appearing After Delay' });
    // No wait before the click: it waits for the button itself.
    await button.click();
    await expect(button).toBeVisible();
  });

  test('waits for content computed on the client after a delay', async ({ page }) => {
    test.slow();
    await page.goto(targetUrl('uiPlayground', '/clientdelay'));
    await page.getByRole('button', { name: 'Button Triggering Client Side Logic' }).click();
    await expect(page.locator('.bg-success')).toHaveText('Data calculated on the client side.', {
      timeout: 25_000,
    });
  });

  test('sends a real mouse click, which a synthetic DOM click would not', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/click'));
    const button = page.locator('#badButton');
    await button.click();
    await expect(button).toHaveClass(/btn-success/);
  });

  test('scrolls a covered field into view before typing in it', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/overlapped'));
    const name = page.locator('#name');
    // Another element covers this field. click() notices it would not receive the
    // event, scrolls until it does, and only then clicks: no manual scrolling needed.
    await name.click();
    await name.pressSequentially('Logesh');
    await expect(name).toHaveValue('Logesh');
  });
});
