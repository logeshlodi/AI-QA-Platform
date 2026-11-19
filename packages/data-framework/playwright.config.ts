import { historyReporter } from '@aiqa/reporting-engine';
import { defineConfig } from '@playwright/test';
import { loadEnv } from '@aiqa/shared';

const env = loadEnv();

/** No browser here: Playwright's runner, fixtures, retries and reports, pointed at a database and a broker. */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    ...historyReporter(),
  ],
  projects: [
    { name: 'stack', testMatch: /setup\/.*\.setup\.ts/ },
    { name: 'data', dependencies: ['stack'], testIgnore: /setup\// },
  ],
});
