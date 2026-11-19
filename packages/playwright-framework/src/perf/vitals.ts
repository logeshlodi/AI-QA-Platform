import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * Core Web Vitals from inside the page, measured by Google's `web-vitals` library: the same code
 * sites ship to measure their real users. Playwright injects its browser build before any page script
 * runs, so nothing on the page has to change.
 */
const WEB_VITALS_FILE = join(dirname(require.resolve('web-vitals')), 'web-vitals.iife.js');
let webVitalsScript: string | undefined;
// Playwright runs each init script in its own scope, so the build's top-level `var webVitals` would
// stay local: the last line hands it to `window`, where the next init script finds it.
const webVitalsSource = () =>
  (webVitalsScript ??= `${readFileSync(WEB_VITALS_FILE, 'utf8')}\n;window.webVitals = webVitals;`);

export interface WebVitals {
  /** Largest Contentful Paint: when the main content appeared (ms). */
  lcp?: number;
  /** Cumulative Layout Shift: how much the layout jumped (unitless score). */
  cls?: number;
  /** Interaction to Next Paint: slowest response to a click or key press (ms). Needs an interaction. */
  inp?: number;
  /** First Contentful Paint: when anything appeared (ms). */
  fcp?: number;
  /** Time to First Byte: when the server started answering (ms). */
  ttfb?: number;
}

/** Google's published thresholds: [good up to, poor from]. https://web.dev/articles/vitals */
export const VITALS_THRESHOLDS: Record<keyof WebVitals, readonly [number, number]> = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  inp: [200, 500],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
};

export type Rating = 'good' | 'needs-improvement' | 'poor';

export function rate(metric: keyof WebVitals, value: number): Rating {
  const [good, poor] = VITALS_THRESHOLDS[metric];
  return value <= good ? 'good' : value > poor ? 'poor' : 'needs-improvement';
}

/**
 * Starts measuring. Call before the first `goto`: the scripts are added to every page the
 * context opens from now on, and run before the page's own scripts.
 */
export async function observeWebVitals(page: Page): Promise<void> {
  await page.addInitScript({ content: webVitalsSource() });
  await page.addInitScript(() => {
    type Metric = { name: string; value: number };
    type Report = (callback: (metric: Metric) => void, options: { reportAllChanges: boolean }) => void;
    const w = window as unknown as {
      webVitals: Record<'onLCP' | 'onCLS' | 'onINP' | 'onFCP' | 'onTTFB', Report>;
      __aiqaVitals: Record<string, number>;
    };
    w.__aiqaVitals = {};
    const save = (metric: Metric) => {
      w.__aiqaVitals[metric.name.toLowerCase()] = metric.value;
    };
    // reportAllChanges: report every update, not only the final value when the page is hidden.
    const options = { reportAllChanges: true };
    for (const report of ['onLCP', 'onCLS', 'onINP', 'onFCP', 'onTTFB'] as const)
      w.webVitals[report](save, options);
  });
}

/**
 * Reads the values measured so far. With `finalize` (the default) it first tells the page it was
 * hidden, as when a user switches tabs: that is when the library reports its final LCP, CLS and INP.
 * Do it last; the page believes it is in the background afterwards.
 */
export async function collectWebVitals(page: Page, { finalize = true } = {}): Promise<WebVitals> {
  await page.waitForLoadState('load');
  // Two frames and a short pause, so paints that follow the load event are recorded.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 300))));
  if (finalize) {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }
  const values = await page.evaluate(
    () => (window as unknown as { __aiqaVitals?: Record<string, number> }).__aiqaVitals,
  );
  if (!values)
    throw new Error('Web Vitals were not observed: call observeWebVitals(page) before page.goto().');
  const pick = (key: string) =>
    typeof values[key] === 'number' ? Math.round(values[key]! * 1000) / 1000 : undefined;
  return { lcp: pick('lcp'), cls: pick('cls'), inp: pick('inp'), fcp: pick('fcp'), ttfb: pick('ttfb') };
}
