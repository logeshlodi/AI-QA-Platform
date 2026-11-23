import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * The screenshot options a visual test needs when a page is long or keeps changing: a full-page
 * capture, `mask` over content that changes on every load, and a style sheet that hides it (`style` on
 * `page.screenshot`; for `toHaveScreenshot` the same is `stylePath`, set for every visual test in
 * playwright.config.ts).
 * Each is shown by comparing two captures taken a moment apart, so no stored baseline is involved
 * (visual/login.visual.spec.ts is the baseline test).
 */
const PAGE = html(
  'Order history',
  `<style>body { margin: 0; font: 16px sans-serif } section { height: 600px; border-bottom: 1px solid #ccc }
          /* Fixed boxes: the text inside changes, the layout around it does not. */
          .clock, .countdown { display: inline-block; width: 240px; white-space: nowrap; overflow: hidden }</style>
   <header>Signed in · <span class="clock" data-test="clock"></span> · <span class="ad">Offer ends in <b class="countdown"></b></span></header>
   <section>January</section><section>February</section><section>March</section><section>April</section>
   <script>
     const tick = () => {
       document.querySelector('.clock').textContent = new Date().toISOString();
       document.querySelector('.countdown').textContent = Math.random().toString(36).slice(2, 8);
     };
     tick(); setInterval(tick, 50);
   </script>`,
);

/** Waits until the clock shows a new time: proof the page changed between two captures. */
const nextTick = async (page: Page) => {
  const clock = page.getByTestId('clock');
  await expect(clock).not.toHaveText((await clock.textContent()) ?? '');
};

/** Width and height from a PNG's IHDR header. */
const sizeOf = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

test.use({ viewport: { width: 800, height: 600 } });

test.beforeEach(async ({ page }) => {
  await serveLocal(page, { '/': PAGE });
  await page.goto(`${LOCAL_ORIGIN}/`);
});

test('a full-page screenshot covers the whole document, not just the viewport', async ({ page }) => {
  const viewportShot = sizeOf(await page.screenshot());
  const fullShot = sizeOf(await page.screenshot({ fullPage: true }));
  expect(viewportShot).toEqual({ width: 800, height: 600 });
  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(fullShot.height).toBe(documentHeight);
  expect(fullShot.height).toBeGreaterThan(2400);
});

test('content that changes on every load makes two captures differ, until it is masked', async ({ page }) => {
  const before = await page.screenshot();
  await nextTick(page);
  expect(before.equals(await page.screenshot())).toBe(false);

  const changing = [page.getByTestId('clock'), page.locator('.countdown')];
  const masked = async () =>
    page.screenshot({ mask: changing, maskColor: '#ff00ff', animations: 'disabled' });
  const first = await masked();
  await nextTick(page);
  expect(first.equals(await masked())).toBe(true);
});

test('a style sheet for the capture hides what should not be compared', async ({ page }) => {
  // The style applies only while the screenshot is taken; the page itself is unchanged.
  const style = '.clock, .ad { visibility: hidden !important; }';
  const first = await page.screenshot({ style });
  await nextTick(page);
  expect(first.equals(await page.screenshot({ style }))).toBe(true);
  await expect(page.locator('.ad')).toBeVisible();
});
