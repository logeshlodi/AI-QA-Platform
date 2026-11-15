import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

for (const viewport of [
  { name: 'phone', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`the login form is usable on a ${viewport.name} viewport`, async ({ page, loginPage }) => {
    await page.setViewportSize(viewport);
    await loginPage.goto();
    await expect(loginPage.loginButton).toBeInViewport();
    expect(await page.evaluate(() => window.innerWidth)).toBe(viewport.width);
  });
}

test('navigation timing stays within a budget', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'load' });
  const timing = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return {
      ttfb: Math.round(nav!.responseStart),
      domContentLoaded: Math.round(nav!.domContentLoadedEventEnd),
      load: Math.round(nav!.loadEventEnd),
    };
  });
  await testInfo.attach('navigation-timing.json', {
    body: JSON.stringify(timing, null, 2),
    contentType: 'application/json',
  });
  // A generous budget: this catches a regression in kind, not a few milliseconds of network noise.
  expect(timing.domContentLoaded).toBeLessThan(10_000);
});
