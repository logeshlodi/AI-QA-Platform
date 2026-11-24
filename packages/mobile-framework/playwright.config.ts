import { consoleReporter, historyReporter } from '@aiqa/reporting-engine';
import { defineConfig } from '@playwright/test';
import { loadEnv } from '@aiqa/shared';
import type { Platform } from './src/fixtures';

const env = loadEnv();

/**
 * Native apps through Appium, run by Playwright's runner: fixtures, retries, reports and the run
 * history are the same as for every other suite. No browser is launched.
 */
export default defineConfig<object, { platform: Platform }>({
  testDir: './tests',
  testIgnore: /unit\//,
  // One emulator, one session: tests share the device, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: env.CI,
  retries: env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
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
  ],
});
