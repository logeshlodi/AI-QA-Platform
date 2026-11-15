import { defineConfig } from '@playwright/test';
import { loadEnv } from '@aiqa/shared';

const env = loadEnv();

// API specs need no browser: they run on Playwright's request context only.
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  timeout: 45_000,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],
  use: { trace: 'on-first-retry', extraHTTPHeaders: { Accept: 'application/json' } },
  projects: [{ name: 'api' }],
});
