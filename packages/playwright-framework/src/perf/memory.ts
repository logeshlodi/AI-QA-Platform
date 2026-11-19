import type { Page } from '@playwright/test';

export interface HeapGrowth {
  /** JavaScript heap in use after the warm-up rounds (bytes). */
  beforeBytes: number;
  /** ...and after the measured rounds. */
  afterBytes: number;
  rounds: number;
  /** (after - before) / rounds. A steady positive number means each round leaves memory behind. */
  perRoundBytes: number;
}

/**
 * A memory-leak check: does repeating an action keep growing the JavaScript heap?
 *
 * Runs `action` `warmup` times first, forces a garbage collection, reads the heap, runs `action`
 * `rounds` more times, collects again and reads again. Garbage collection before each reading means
 * only memory still referenced is counted. Chromium only (DevTools Protocol).
 *
 * The warm-up has to be long. On TodoMVC (19 Nov 2026) the heap grew 439 KB over the first 20
 * rounds but only 157 KB over the next 40, with Playwright's actions and with plain in-page events
 * alike: caches and compiled code fill up early and then level off. A leak keeps growing in a
 * straight line, so the rounds after a long warm-up are the ones that tell.
 */
export async function measureHeapGrowth(
  page: Page,
  action: () => Promise<void>,
  { warmup = 20, rounds = 40 } = {},
): Promise<HeapGrowth> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  const usedHeap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((m) => m.name === 'JSHeapUsedSize')!.value;
  };
  try {
    for (let i = 0; i < warmup; i++) await action();
    const beforeBytes = await usedHeap();
    for (let i = 0; i < rounds; i++) await action();
    const afterBytes = await usedHeap();
    return {
      beforeBytes,
      afterBytes,
      rounds,
      perRoundBytes: Math.round((afterBytes - beforeBytes) / rounds),
    };
  } finally {
    await cdp.detach();
  }
}
