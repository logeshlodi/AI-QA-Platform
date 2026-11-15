import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

test.describe('frames', () => {
  test('frameLocator reaches into nested frames', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/nested_frames'));
    const top = page.frameLocator('frame[name="frame-top"]');
    await expect(top.frameLocator('frame[name="frame-middle"]').locator('#content')).toHaveText('MIDDLE');
    await expect(top.frameLocator('frame[name="frame-left"]').locator('body')).toContainText('LEFT');
    await expect(page.frameLocator('frame[name="frame-bottom"]').locator('body')).toContainText('BOTTOM');
  });

  test('contentFrame turns an iframe locator into a frame locator', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/iframe'));
    const editor = page.locator('iframe[title="Rich Text Area"]').contentFrame();
    await expect(editor.locator('body')).toContainText('Your content goes here.');
  });

  // Playwright 1.63+: frameLocator() with no selector searches every frame on the page.
  test('a selector-less frameLocator finds the element in whichever frame holds it', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/nested_frames'));
    await expect(page.frameLocator().locator('#content')).toHaveText('MIDDLE');
  });
});
