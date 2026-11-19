import type { Page } from '@playwright/test';

export interface ResourceSummary {
  /** Requests the page made, the document included. */
  requests: number;
  /** Bytes over the network, headers included. 0 for cached files. */
  transferBytes: number;
  /** Bytes after decompression: what the browser had to parse. */
  decodedBytes: number;
  /** Per kind of request, as the browser names it: script, css, img, fetch, xmlhttprequest, ... */
  byType: Record<string, { requests: number; transferBytes: number; decodedBytes: number }>;
  /** Requests to other origins than the page's own. */
  thirdPartyRequests: number;
  /** The five biggest files by decoded size. */
  largest: { url: string; type: string; decodedBytes: number }[];
}

/**
 * Sums up every file the page loaded, from the browser's Resource Timing entries.
 *
 * Cross-origin files report sizes only when their server sends `Timing-Allow-Origin`; otherwise
 * they count as requests with 0 bytes. Sizes are therefore a floor, which is fine for a budget.
 */
export async function summarizeResources(page: Page): Promise<ResourceSummary> {
  return page.evaluate(() => {
    const entries = [
      ...(performance.getEntriesByType('navigation') as PerformanceResourceTiming[]),
      ...(performance.getEntriesByType('resource') as PerformanceResourceTiming[]),
    ];
    const byType: Record<string, { requests: number; transferBytes: number; decodedBytes: number }> = {};
    let transferBytes = 0;
    let decodedBytes = 0;
    let thirdPartyRequests = 0;
    for (const entry of entries) {
      const type = entry.entryType === 'navigation' ? 'document' : entry.initiatorType || 'other';
      const bucket = (byType[type] ??= { requests: 0, transferBytes: 0, decodedBytes: 0 });
      bucket.requests += 1;
      bucket.transferBytes += entry.transferSize;
      bucket.decodedBytes += entry.decodedBodySize;
      transferBytes += entry.transferSize;
      decodedBytes += entry.decodedBodySize;
      if (new URL(entry.name, location.href).origin !== location.origin) thirdPartyRequests += 1;
    }
    const largest = entries
      .map((e) => ({
        url: e.name,
        type: e.entryType === 'navigation' ? 'document' : e.initiatorType,
        decodedBytes: e.decodedBodySize,
      }))
      .sort((a, b) => b.decodedBytes - a.decodedBytes)
      .slice(0, 5);
    return { requests: entries.length, transferBytes, decodedBytes, byType, thirdPartyRequests, largest };
  });
}
