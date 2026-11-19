import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';
import { SAUCE_AUTH_FILE } from '../../src/paths';
import {
  collectWebVitals,
  observeWebVitals,
  overBudget,
  rate,
  recordMetrics,
  withPerformanceTrace,
  type WebVitals,
} from '../../src/perf';

// Single-user measurements of public demo sites: a few page loads per run, never load.
//
// These sites are reached over the internet from wherever the tests run, so the budget is Google's
// "poor" threshold, not "good": the test catches a page that became slow, not a slow connection.
// The run history keeps every value, and `aiqa perf` flags a metric that drifts from its usual level.
const NOT_POOR = { lcp_ms: 4000, cls: 0.25, fcp_ms: 3000, ttfb_ms: 1800 };

const asMetrics = (v: WebVitals) => ({
  lcp_ms: v.lcp,
  cls: v.cls,
  fcp_ms: v.fcp,
  ttfb_ms: v.ttfb,
  inp_ms: v.inp,
});

test.describe('Core Web Vitals', { tag: '@perf' }, () => {
  test.describe('SauceDemo', () => {
    test.use({ targetName: 'saucedemo' });

    test('the login page is not rated poor on any Core Web Vital', async ({ page }, testInfo) => {
      await observeWebVitals(page);
      await withPerformanceTrace(page, testInfo, 'login-page', () => page.goto('/'));
      const vitals = await collectWebVitals(page);
      await recordMetrics(testInfo, asMetrics(vitals), 'web-vitals');
      expect(overBudget(asMetrics(vitals), NOT_POOR)).toEqual([]);
    });

    test.describe('logged in', () => {
      test.use({ storageState: SAUCE_AUTH_FILE });

      test('the inventory page is not rated poor on any Core Web Vital', async ({ page }, testInfo) => {
        await observeWebVitals(page);
        await page.goto('/inventory.html');
        const vitals = await collectWebVitals(page);
        await recordMetrics(testInfo, asMetrics(vitals), 'web-vitals');
        expect(overBudget(asMetrics(vitals), NOT_POOR)).toEqual([]);
      });
    });
  });

  test.describe('TodoMVC', () => {
    test.use({ targetName: 'todomvc' });

    // INP needs real interactions: it is the slowest response to a click or key press. Held to "not
    // poor" like the other vitals: on a 2-CPU CI runner one interaction in twenty took over 200 ms
    // ("good" stops there). The run history tracks the actual value.
    test('adding and completing todos keeps INP out of "poor"', async ({ page }, testInfo) => {
      await observeWebVitals(page);
      await page.goto(targetUrl('todomvc', '/'));
      const input = page.getByPlaceholder('What needs to be done?');
      for (const todo of ['buy milk', 'write tests', 'review the run history']) {
        await input.fill(todo);
        await input.press('Enter');
      }
      for (const toggle of await page.getByRole('checkbox', { name: 'Toggle Todo' }).all())
        await toggle.check();
      await expect(page.getByText('0 items left')).toBeVisible();

      const vitals = await collectWebVitals(page);
      await recordMetrics(testInfo, asMetrics(vitals), 'web-vitals');
      expect(vitals.inp, 'INP is measured once the page has had interactions').toBeDefined();
      expect(rate('inp', vitals.inp!)).not.toBe('poor');
    });
  });
});
