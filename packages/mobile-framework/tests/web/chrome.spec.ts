import { expect, test } from '../../src/web-fixtures';

// A page in Chrome on the phone, through Appium and Chromedriver. The page is served from this
// machine (fixtures/web/index.html) and reached through adb reverse.

test.describe('A web page in Chrome on Android', { tag: ['@mobile', '@android', '@web'] }, () => {
  test.beforeEach(async ({ chrome, site }) => {
    await chrome.url(site.url);
    await chrome.$('h1').waitForDisplayed();
  });

  test('the order form answers with the order status', async ({ chrome }) => {
    await chrome.$('#order').setValue('1042');
    await chrome.$('button[type="submit"]').click();
    await expect.poll(() => chrome.$('#result').getText()).toBe('Order 1042 is on its way.');
  });

  test('the form explains a wrong order number', async ({ chrome }) => {
    await chrome.$('#order').setValue('12');
    await chrome.$('button[type="submit"]').click();
    await expect.poll(() => chrome.$('#result').getText()).toBe('Enter a four-digit order number.');
  });

  test('the page fits the phone screen without sideways scrolling', async ({ chrome }) => {
    const { scrollWidth, innerWidth } = await chrome.execute(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('pinching out zooms the page in, as two fingers would', async ({ chrome }) => {
    const scale = () => chrome.execute(() => window.visualViewport?.scale ?? 1);
    expect(await scale()).toBe(1);

    // Gestures are native: switch out of the web page, pinch over Chrome's content, switch back.
    const web = await chrome.getContext();
    await chrome.switchContext('NATIVE_APP');
    const { width, height } = await chrome.getWindowSize();
    await chrome.execute('mobile: pinchOpenGesture', {
      left: Math.round(width * 0.2),
      top: Math.round(height * 0.35),
      width: Math.round(width * 0.6),
      height: Math.round(height * 0.3),
      percent: 0.75,
    });
    await chrome.switchContext(String(web));

    await expect.poll(scale).toBeGreaterThan(1.2);
  });
});
