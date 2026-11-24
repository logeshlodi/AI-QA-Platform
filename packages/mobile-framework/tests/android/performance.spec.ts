import { APPS } from '../../src/apps';
import { expect, test } from '../../src/fixtures';
import { coldStart, memoryPssKb, peakCpuWhile } from '../../src/performance';

// Android's own numbers for the demo app. The budgets are wide because an emulator is slower and
// noisier than a phone: they catch a large regression. Every reading also goes into the run
// history as a `metric`, so `aiqa perf` compares it with its usual level and flags a drift long
// before it reaches the budget.

const demo = APPS.demo;

test.describe('Performance of the demo app', { tag: ['@mobile', '@android', '@performance'] }, () => {
  test('a cold start reaches the first frame within 8 s', async ({ driver }, testInfo) => {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await coldStart(driver, demo.appPackage, demo.appActivity));
    const times = runs.map((r) => r.totalTimeMs).sort((a, b) => a - b);
    const median = times[1]!;
    testInfo.annotations.push(
      { type: 'cold start (median of 3)', description: `${median} ms; all: ${times.join(', ')} ms` },
      { type: 'metric', description: `mobile_cold_start_ms=${median}` },
    );
    expect(runs.every((r) => !r.launchState || r.launchState === 'COLD')).toBe(true);
    expect(median).toBeLessThan(8_000);
  });

  test('the app uses under 400 MB of memory after visiting every tab', async ({
    screens,
    driver,
  }, testInfo) => {
    for (const tab of ['Webview', 'Login', 'Forms', 'Swipe', 'Drag', 'Home'] as const)
      await screens.nav.open(tab);
    const pssKb = await memoryPssKb(driver, demo.appPackage);
    testInfo.annotations.push(
      { type: 'memory (TOTAL PSS)', description: `${Math.round(pssKb / 1024)} MB` },
      { type: 'metric', description: `mobile_memory_pss_mb=${Math.round(pssKb / 1024)}` },
    );
    expect(pssKb).toBeLessThan(400 * 1024);
  });

  test('swiping the carousel keeps the app under two CPU cores', async ({ screens, driver }, testInfo) => {
    await screens.nav.open('Swipe');
    await screens.swipe.waitUntilShown();
    const peak = await peakCpuWhile(driver, demo.appPackage, async () => {
      for (const direction of ['left', 'left', 'right', 'right'] as const)
        await screens.swipe.swipeCarousel(direction);
    });
    testInfo.annotations.push(
      { type: 'CPU (peak, % of one core)', description: `${peak}%` },
      { type: 'metric', description: `mobile_swipe_cpu_peak_pct=${peak}` },
    );
    expect(peak).toBeLessThan(200);
  });
});
