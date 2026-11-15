import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';
import fs from 'node:fs';

test.use({ targetName: 'theInternet' });

test.describe('files and drag and drop', () => {
  test('uploads a file created in memory', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/upload'));
    await page.locator('#file-upload').setInputFiles({
      name: 'aiqa-note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello from playwright'),
    });
    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(page.getByRole('heading', { name: 'File Uploaded!' })).toBeVisible();
    await expect(page.locator('#uploaded-files')).toHaveText('aiqa-note.txt');
  });

  test('downloads a file and saves it', async ({ page }, testInfo) => {
    await page.goto(targetUrl('theInternet', '/download'));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.example a').first().click();
    const download = await downloadPromise;
    const target = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(target);
    expect(fs.existsSync(target)).toBe(true);
  });

  test('drags one box onto another', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/drag_and_drop'));
    await expect(page.locator('#column-a header')).toHaveText('A');
    await page.locator('#column-a').dragTo(page.locator('#column-b'));
    await expect(page.locator('#column-a header')).toHaveText('B');
  });
});
