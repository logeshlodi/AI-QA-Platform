import fs from 'node:fs';
import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * Files beyond one upload and one download (files-and-drag.spec.ts): several files at once, the file
 * chooser a button opens, and a download whose content is checked, not just its presence. On a local
 * page, so the content is known.
 */
const UPLOADER = html(
  'Uploads',
  `<label>Attachments <input id="files" type="file" multiple></label>
   <button id="browse" onclick="document.getElementById('hidden').click()">Add receipts</button>
   <input id="hidden" type="file" multiple accept=".pdf,.png" hidden>
   <ul id="list" aria-label="Chosen files"></ul>
   <script>
     const show = (input) => {
       const list = document.getElementById('list');
       list.innerHTML = '';
       for (const f of input.files) {
         const li = document.createElement('li');
         li.textContent = f.name + ' (' + f.size + ' bytes)';
         list.append(li);
       }
     };
     document.getElementById('files').addEventListener('change', (e) => show(e.target));
     document.getElementById('hidden').addEventListener('change', (e) => show(e.target));
   </script>`,
);

test.describe('files', () => {
  test('several files go into one input at once', async ({ page }) => {
    await serveLocal(page, { '/': UPLOADER });
    await page.goto(`${LOCAL_ORIGIN}/`);
    await page.getByLabel('Attachments').setInputFiles([
      { name: 'invoice.txt', mimeType: 'text/plain', buffer: Buffer.from('total 42.00') },
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('paid') },
    ]);
    await expect(page.getByRole('listitem')).toHaveText(['invoice.txt (11 bytes)', 'notes.txt (4 bytes)']);

    // An empty list clears the input again.
    await page.getByLabel('Attachments').setInputFiles([]);
    expect(await page.getByLabel('Attachments').evaluate((i: HTMLInputElement) => i.files?.length)).toBe(0);
  });

  test('a button that opens a hidden input: answer the file chooser it raises', async ({ page }) => {
    await serveLocal(page, { '/': UPLOADER });
    await page.goto(`${LOCAL_ORIGIN}/`);
    // The input is hidden, so there is nothing to call setInputFiles on: wait for the chooser instead.
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add receipts' }).click();
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(true);
    await chooser.setFiles([
      { name: 'receipt-1.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 one') },
      { name: 'receipt-2.png', mimeType: 'image/png', buffer: Buffer.from('PNG two') },
    ]);
    await expect(page.getByRole('listitem')).toHaveText([
      'receipt-1.pdf (12 bytes)',
      'receipt-2.png (7 bytes)',
    ]);
  });

  test('a downloaded report has the right name, rows and totals', async ({ page }, testInfo) => {
    const csv = 'order,total\n1001,19.99\n1002,5.01\n';
    await serveLocal(page, {
      '/': html('Reports', '<a href="/export">Export orders</a>'),
      '/export': {
        body: csv,
        contentType: 'text/csv',
        headers: { 'content-disposition': 'attachment; filename="orders-2026-11.csv"' },
      },
    });
    await page.goto(`${LOCAL_ORIGIN}/`);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export orders' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('orders-2026-11.csv');
    expect(await download.failure()).toBeNull();

    const file = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(file);
    const [header, ...rows] = fs.readFileSync(file, 'utf8').trim().split('\n');
    expect(header).toBe('order,total');
    expect(rows).toHaveLength(2);
    const total = rows.reduce((sum, row) => sum + Number(row.split(',')[1]), 0);
    expect(total.toFixed(2)).toBe('25.00');
    await testInfo.attach('download', { path: file, contentType: 'text/csv' });
  });
});
