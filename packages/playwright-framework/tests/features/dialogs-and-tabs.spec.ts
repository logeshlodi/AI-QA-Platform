import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

test.describe('dialogs and new tabs', () => {
  test('accepts an alert, dismisses a confirm, answers a prompt', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/javascript_alerts'));
    const result = page.locator('#result');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Click for JS Alert' }).click();
    await expect(result).toHaveText('You successfully clicked an alert');

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Click for JS Confirm' }).click();
    await expect(result).toHaveText('You clicked: Cancel');

    page.once('dialog', (dialog) => dialog.accept('playwright'));
    await page.getByRole('button', { name: 'Click for JS Prompt' }).click();
    await expect(result).toHaveText('You entered: playwright');
  });

  // Runs on a local page: the hosted context-menu demo does not render its target reliably.
  test('a right-click fires the contextmenu handler', async ({ page }) => {
    await page.setContent(`<div id="zone" style="width:200px;height:100px;border:1px dashed"
      oncontextmenu="event.preventDefault(); this.textContent = 'menu opened'">right-click me</div>`);
    await page.locator('#zone').click({ button: 'right' });
    await expect(page.locator('#zone')).toHaveText('menu opened');
  });

  test('follows a link that opens a new tab', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/windows'));
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Click Here' }).click();
    const popup = await popupPromise;
    await expect(popup.getByRole('heading', { name: 'New Window' })).toBeVisible();
    expect(page.context().pages()).toHaveLength(2);
  });
});
