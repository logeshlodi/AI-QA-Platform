import { expect, test } from '../../src/fixtures';
import { collectWebVitals, observeWebVitals, overBudget, recordMetrics, throttle } from '../../src/perf';

// The same page on a mid-range phone: Lighthouse's mobile profile (slow 4G and a CPU four times
// slower). Fast office connections hide what many real users see.
//
// The budget is LCP not rated "poor" (Google's 4-second line), as for the unthrottled pages. Slowing
// the CPU multiplies the machine's own speed and unevenness: LCP was 2.0 to 2.2 s on the laptop but
// 2.0 to 3.6 s on a 2-CPU Linux container like a CI runner (20 Nov 2026). FCP and TTFB are recorded
// for the trend without a budget of their own.
const SLOW_PHONE_BUDGET = { lcp_ms: 4000 };

test.describe('on a slow phone connection', { tag: '@perf' }, () => {
  test.use({ targetName: 'saucedemo' });

  test('the login page still paints within its slow-network budget', async ({ page }, testInfo) => {
    await throttle(page, { network: 'slow-4g', cpuSlowdown: 4 });
    await observeWebVitals(page);
    await page.goto('/');
    const vitals = await collectWebVitals(page);
    const metrics = { lcp_ms: vitals.lcp, fcp_ms: vitals.fcp, ttfb_ms: vitals.ttfb };
    await recordMetrics(testInfo, metrics, 'web-vitals-slow-4g');
    expect(overBudget(metrics, SLOW_PHONE_BUDGET)).toEqual([]);
  });
});
