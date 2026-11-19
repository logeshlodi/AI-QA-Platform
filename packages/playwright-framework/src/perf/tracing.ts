import type { Page, TestInfo } from '@playwright/test';

/**
 * Records a Chrome performance trace (the one DevTools' Performance panel shows) around `body`,
 * and attaches it to the test. Open it in DevTools > Performance > Load profile, or in
 * https://ui.perfetto.dev. Unlike Playwright's own trace, it shows the main thread: scripting,
 * layout, paint, long tasks.
 *
 * Off unless `PERF_TRACE=1`: a trace is several megabytes. Chromium only.
 */
export async function withPerformanceTrace<T>(
  page: Page,
  testInfo: TestInfo,
  name: string,
  body: () => Promise<T>,
): Promise<T> {
  const browser = page.context().browser();
  if (process.env.PERF_TRACE !== '1' || browser?.browserType().name() !== 'chromium') return body();
  await browser.startTracing(page, { screenshots: true });
  try {
    return await body();
  } finally {
    const trace = await browser.stopTracing();
    await testInfo.attach(`${name}.performance-trace.json`, { body: trace, contentType: 'application/json' });
  }
}
