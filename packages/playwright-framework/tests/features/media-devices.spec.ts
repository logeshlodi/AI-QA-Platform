import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * Camera and microphone without hardware: Chromium's fake devices give a test pattern and a beep, and
 * skip the permission prompt. Launch flags apply to the whole browser, so they are set for this file
 * (a new worker), not for one test. With a shared browser server (PW_WS_ENDPOINT) the server's own
 * launch flags apply instead, so the spec is skipped there.
 */
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});
test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium fake media devices');
test.skip(Boolean(process.env.PW_WS_ENDPOINT), 'launch flags do not reach a shared browser server');

test.describe('camera and microphone', () => {
  test('the page gets a camera and a microphone track from the fake devices', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone'], { origin: LOCAL_ORIGIN });
    await serveLocal(page, {
      '/': html(
        'Video call',
        `<video autoplay playsinline muted></video>
         <button onclick="navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((s) => {
           document.querySelector('video').srcObject = s;
           document.getElementById('status').textContent = s.getTracks().map((t) => t.kind).sort().join(' and ');
         })">Join call</button>
         <p id="status" role="status"></p>`,
      ),
    });
    await page.goto(`${LOCAL_ORIGIN}/`);

    await page.getByRole('button', { name: 'Join call' }).click();
    await expect(page.getByRole('status')).toHaveText('audio and video');
    // The video element is playing real frames from the fake camera.
    await expect
      .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    const devices = await page.evaluate(() =>
      navigator.mediaDevices.enumerateDevices().then((list) => list.map((d) => d.kind)),
    );
    expect(devices).toEqual(expect.arrayContaining(['audioinput', 'videoinput']));
  });
});
