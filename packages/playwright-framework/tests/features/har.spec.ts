import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';
import fs from 'node:fs';

test.use({ targetName: 'apiMocking' });

const REPLAYED = 'Aiqa-fruit'; // same length as "Strawberry"

// Record real traffic once, then replay it: fast, deterministic, and offline for that API.
test('records a HAR, edits it, and replays it', async ({ browser }, testInfo) => {
  const har = testInfo.outputPath('fruits.har');
  const options = { url: '*/**/api/v1/fruits', updateContent: 'embed' as const };

  await test.step('record', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.routeFromHAR(har, { ...options, update: true });
    await page.goto(targetUrl('apiMocking', '/'));
    await expect(page.getByText('Strawberry')).toBeVisible();
    await context.close(); // the HAR file is written when the context closes
  });

  await test.step('edit the recording so the replay is unmistakable', async () => {
    type Entry = { response: { content: { text?: string; encoding?: string } } };
    const recording = JSON.parse(fs.readFileSync(har, 'utf8')) as { log: { entries: Entry[] } };
    for (const { response } of recording.log.entries) {
      const { content } = response;
      if (!content.text) continue;
      // Bodies are stored as base64 when embedded. The replacement keeps the same length.
      const base64 = content.encoding === 'base64';
      const body = base64 ? Buffer.from(content.text, 'base64').toString('utf8') : content.text;
      const edited = body.replaceAll('Strawberry', REPLAYED);
      content.text = base64 ? Buffer.from(edited, 'utf8').toString('base64') : edited;
    }
    fs.writeFileSync(har, JSON.stringify(recording));
  });

  await test.step('replay', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.routeFromHAR(har, { ...options, update: false });
    await page.goto(targetUrl('apiMocking', '/'));
    await expect(page.getByText(REPLAYED)).toBeVisible();
    await expect(page.getByText('Strawberry')).toBeHidden();
    await context.close();
  });
});
