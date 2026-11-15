import { defineConfig, devices } from '@playwright/test';
import { loadEnv, targetUrl } from '@aiqa/shared';
import type { Options } from './src/fixtures';

const env = loadEnv();

// Locator and feature labs teach one thing each; running them once, on Chromium, is enough.
// Journeys and smoke tests are the cross-browser suite.
const LABS = ['**/locators/**', '**/features/**', '**/healing/**', '**/visual/**'];
const ready = ['setup', 'auth'];

// PW_CHANNEL=chrome (or msedge) runs the "chromium" project in an installed browser
// instead of the bundled one. Handy behind a proxy that blocks browser downloads.
const channel = process.env.PW_CHANNEL || undefined;
// PW_BRANDED_BROWSERS=chrome,msedge adds smoke runs in real Chrome and Edge.
const branded = (process.env.PW_BRANDED_BROWSERS ?? '').split(',').filter(Boolean);

export default defineConfig<Options>({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  workers: env.CI ? 4 : undefined,
  timeout: 30_000,
  // Visual baselines are per operating system. CI skips the comparison until Linux baselines are committed.
  ignoreSnapshots: env.CI,
  expect: { timeout: 7_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    ...(env.CI ? ([['blob'], ['github']] as const) : []),
  ],
  metadata: { product: 'AI-QA-Platform', healMode: env.HEAL_MODE, aiEnabled: env.AI_ENABLED },
  use: {
    baseURL: targetUrl('saucedemo'),
    // SauceDemo marks elements with data-test. Specs for other sites override this with test.use().
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Runs first: health-checks every target, then saves a logged-in session.
    { name: 'setup', testMatch: '**/health.setup.ts' },
    { name: 'auth', testMatch: '**/auth.setup.ts', dependencies: ['setup'] },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel }, dependencies: ready },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ready, testIgnore: LABS },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, dependencies: ready, testIgnore: LABS },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, dependencies: ready, testMatch: '**/smoke/**' },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      dependencies: ready,
      testMatch: '**/smoke/**',
    },
    ...branded.map((name) => ({
      name,
      use: { ...devices['Desktop Chrome'], channel: name },
      dependencies: ready,
      testMatch: '**/smoke/**',
    })),
  ],
});
