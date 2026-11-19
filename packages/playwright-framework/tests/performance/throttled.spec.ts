import { expect, test } from '../../src/fixtures';
import { collectWebVitals, observeWebVitals, overBudget, recordMetrics, throttle } from '../../src/perf';

// The same page on a mid-range phone: Lighthouse's mobile profile (slow 4G and a CPU four times
// slower). Fast office connections hide what many real users see.
//
// Measured on 19 Nov 2026 and set about 50% above, since throttled timings vary more.
// LCP 2068 to 2184 ms, FCP 1752 to 1868 ms.
const SLOW_PHONE_BUDGET = { lcp_ms: 3200, fcp_ms: 2800 };

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
