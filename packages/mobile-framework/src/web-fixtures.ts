import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import { remote, type Browser } from 'webdriverio';
import { AppiumServer } from './appium-server';
import { mobileConfig } from './config';
import { attachEvidence } from './evidence';
import { chromeCapabilities, reversePort, startTestSite, type TestSite } from './web';

/**
 * Mobile web through Appium: Chrome on the device, driven by Chromedriver, with WebdriverIO's
 * web commands (`url`, `$('#order')`, `execute`) and native gestures when the test switches to
 * the NATIVE_APP context. The page under test is served from this machine (src/web.ts).
 */

interface WorkerFixtures {
  appium: AppiumServer;
  /** One Chrome session per worker (named `chrome`: Playwright's own fixture is `browser`). */
  chrome: Browser;
  /** The local page, reachable from the device. */
  site: TestSite;
}

const config = mobileConfig();

export const test = base.extend<{ evidence: void }, WorkerFixtures>({
  appium: [
    async ({}, use, workerInfo) => {
      const server = await AppiumServer.start({
        logFile: path.join(workerInfo.project.outputDir, `appium-worker-${workerInfo.workerIndex}.log`),
      });
      await use(server);
      await server.stop();
    },
    { scope: 'worker', timeout: 200_000 },
  ],

  site: [
    async ({}, use) => {
      const site = await startTestSite();
      const undo = reversePort(site.port, config.udid);
      await use(site);
      undo();
      await site.close();
    },
    { scope: 'worker' },
  ],

  chrome: [
    async ({ appium }, use) => {
      const browser = await remote({
        hostname: '127.0.0.1',
        port: appium.port,
        path: '/',
        logLevel: 'warn',
        connectionRetryTimeout: config.bootTimeoutMs + 120_000,
        connectionRetryCount: 0,
        capabilities: chromeCapabilities(config) as WebdriverIO.Capabilities,
      });
      await use(browser);
      await browser.deleteSession();
    },
    { scope: 'worker', timeout: config.bootTimeoutMs + 180_000 },
  ],

  evidence: [
    async ({ chrome, appium }, use, testInfo) => {
      const mark = appium.mark();
      await use();
      if (testInfo.status !== testInfo.expectedStatus) {
        await attachEvidence(testInfo, { driver: chrome, serverLog: () => appium.since(mark) });
      }
    },
    { auto: true },
  ],
});

export { expect };
