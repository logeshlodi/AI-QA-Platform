import type { CDPSession, Page } from '@playwright/test';

export interface NetworkConditions {
  /** Added round-trip time (ms). */
  latencyMs: number;
  /** Bits per second. */
  downloadBps: number;
  uploadBps: number;
}

/**
 * Network profiles. `slow-4g` matches Lighthouse's mobile run (150 ms, 1.6 Mbps down, 750 kbps up),
 * which Lighthouse pairs with a 4x slower CPU. `fast-3g` matches the Chrome DevTools preset.
 */
export const NETWORK_PROFILES = {
  'slow-4g': { latencyMs: 150, downloadBps: 1.6 * 1024 * 1024, uploadBps: 750 * 1024 },
  'fast-3g': { latencyMs: 562.5, downloadBps: 1.44 * 1024 * 1024, uploadBps: 675 * 1024 },
} as const satisfies Record<string, NetworkConditions>;

export type NetworkProfile = keyof typeof NETWORK_PROFILES;

export interface ThrottleOptions {
  network?: NetworkProfile | NetworkConditions;
  /** 4 means "the CPU is four times slower", as on a mid-range phone. */
  cpuSlowdown?: number;
}

/**
 * Slows the page's network and CPU through the Chrome DevTools Protocol, as DevTools' throttling
 * menu does. Chromium only: Firefox and WebKit have no equivalent in Playwright.
 * Throttling lasts while the returned session is open; `detach()` it, or let the test end.
 */
export async function throttle(page: Page, { network, cpuSlowdown }: ThrottleOptions): Promise<CDPSession> {
  const browserName = page.context().browser()?.browserType().name();
  if (browserName !== 'chromium') throw new Error(`Throttling needs Chromium, not ${browserName}.`);
  const cdp = await page.context().newCDPSession(page);
  if (network) {
    const c = typeof network === 'string' ? NETWORK_PROFILES[network] : network;
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: c.latencyMs,
      // The protocol wants bytes per second.
      downloadThroughput: c.downloadBps / 8,
      uploadThroughput: c.uploadBps / 8,
    });
  }
  if (cpuSlowdown) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown });
  return cdp;
}
