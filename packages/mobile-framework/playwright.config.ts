import { consoleReporter, historyReporter } from '@aiqa/reporting-engine';
import { defineConfig } from '@playwright/test';
import { loadEnv } from '@aiqa/shared';
import type { AppName } from './src/apps';
import type { Platform } from './src/fixtures';

const env = loadEnv();

/**
 * Native apps through Appium, run by Playwright's runner: fixtures, retries, reports and the run
 * history are the same as for every other suite. No browser is launched.
 */
export default defineConfig<object, { platform: Platform; appName: AppName }>({
  testDir: './tests',
  testIgnore: /unit\//,
  // One emulator, one session: tests share the device, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: env.CI,
  retries: env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Screenshots come from the emulator, not the machine running the tests, so the saved pictures
  // are not per operating system. Each project has its own test folder, so the path is unique.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  reporter: [
    ...consoleReporter(),
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    ...historyReporter(),
  ],
  projects: [
    // Names what is missing (SDK, emulator, apps) before any Android test starts.
    { name: 'device', testMatch: /setup\/.*\.setup\.ts/ },
    // Appium's fake driver: the framework's own plumbing, on any machine (no device).
    { name: 'fake', testMatch: /fake\/.*\.spec\.ts/, use: { platform: 'fake' } },
    // The demo app on an Android emulator or phone. `pnpm mobile doctor` says what is missing.
    {
      name: 'android',
      dependencies: ['device'],
      testMatch: /android\/.*\.spec\.ts/,
      use: { platform: 'android' },
    },
    // Chrome on the device with a page served from this machine, through Appium and Chromedriver.
    {
      name: 'android-chrome',
      dependencies: ['device'],
      testMatch: /web\/.*\.spec\.ts/,
    },
    // The same page through Playwright's own experimental Android support, for comparison. After
    // the Appium projects: both drive the device's UI automation, so never at the same time.
    {
      name: 'android-playwright',
      dependencies: ['device'],
      testMatch: /playwright-android\/.*\.spec\.ts/,
    },
    // ApiDemos: classic Android views, toasts, the notification shade. Its own worker and session.
    {
      name: 'android-apidemos',
      dependencies: ['device'],
      testMatch: /apidemos\/.*\.spec\.ts/,
      use: { platform: 'android', appName: 'apidemos' },
    },
  ],
});
