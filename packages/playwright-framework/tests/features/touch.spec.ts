import { devices } from '@playwright/test';
import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * Touch on a tablet: tap, and a swipe made of real touch events. A device descriptor sets the
 * viewport, the user agent, `isMobile` and `hasTouch`; `defaultBrowserType` is left out because a spec
 * cannot change the browser, only the project can (the `tablet` project runs the smoke suite on an
 * iPad in WebKit). Chromium only: the swipe goes through the DevTools protocol.
 */
const galaxyTab = { ...devices['Galaxy Tab S9'], defaultBrowserType: undefined };
test.use({ ...galaxyTab });
test.skip(({ browserName }) => browserName !== 'chromium', 'the swipe uses the DevTools protocol');

const GALLERY = html(
  'Gallery',
  `<style>#strip { display: flex; width: 300px; height: 200px; overflow: hidden; touch-action: pan-y; }
          #strip div { flex: 0 0 300px; }</style>
   <button id="like">Like</button> <span id="likes" role="status">0 likes</span>
   <div id="strip" aria-label="Photos"><div>Photo 1</div><div>Photo 2</div><div>Photo 3</div></div>
   <p id="shown">Photo 1 of 3</p>
   <p id="pointer"></p>
   <script>
     let photo = 0, startX = 0, likes = 0;
     const strip = document.getElementById('strip');
     document.getElementById('like').addEventListener('pointerdown', (e) =>
       (document.getElementById('pointer').textContent = 'pointer: ' + e.pointerType));
     document.getElementById('like').addEventListener('click', () =>
       (document.getElementById('likes').textContent = ++likes + (likes === 1 ? ' like' : ' likes')));
     strip.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX));
     strip.addEventListener('touchend', (e) => {
       const dx = e.changedTouches[0].clientX - startX;
       if (Math.abs(dx) > 50) photo = Math.min(2, Math.max(0, photo + (dx < 0 ? 1 : -1)));
       strip.scrollLeft = photo * 300;
       document.getElementById('shown').textContent = 'Photo ' + (photo + 1) + ' of 3';
     });
   </script>`,
);

test.describe('touch on a tablet', () => {
  test('the page sees a touch device with a coarse pointer', async ({ page }) => {
    await serveLocal(page, { '/': GALLERY });
    await page.goto(`${LOCAL_ORIGIN}/`);
    expect(
      await page.evaluate(() => ({
        touch: navigator.maxTouchPoints > 0,
        coarse: matchMedia('(pointer: coarse)').matches,
        width: innerWidth,
      })),
    ).toEqual({ touch: true, coarse: true, width: galaxyTab.viewport.width });
  });

  test('tap is a touch, and still fires click', async ({ page }) => {
    await serveLocal(page, { '/': GALLERY });
    await page.goto(`${LOCAL_ORIGIN}/`);
    await page.getByRole('button', { name: 'Like' }).tap();
    await expect(page.locator('#pointer')).toHaveText('pointer: touch');
    await expect(page.getByRole('status')).toHaveText('1 like');
  });

  test('a swipe left moves to the next photo, a swipe right back', async ({ page }) => {
    await serveLocal(page, { '/': GALLERY });
    await page.goto(`${LOCAL_ORIGIN}/`);
    const box = (await page.getByLabel('Photos').boundingBox())!;
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    // A swipe is touchStart, a few touchMoves and touchEnd, as a finger would make them.
    const swipe = async (fromX: number, toX: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
      for (let i = 1; i <= 5; i++) {
        const x = fromX + ((toX - fromX) * i) / 5;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };

    await swipe(box.x + 250, box.x + 50);
    await expect(page.locator('#shown')).toHaveText('Photo 2 of 3');
    await swipe(box.x + 50, box.x + 250);
    await expect(page.locator('#shown')).toHaveText('Photo 1 of 3');
  });
});
