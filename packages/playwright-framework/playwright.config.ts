import { historyReporter } from '@aiqa/reporting-engine';
import { defineConfig, devices } from '@playwright/test';
import { loadEnv, targetUrl } from '@aiqa/shared';
import type { Options } from './src/fixtures';

const env = loadEnv();

// Locator and feature labs teach one thing each; running them once, on Chromium, is enough.
// Journeys and smoke tests are the cross-browser suite.
const LABS = [
  '**/locators/**',
  '**/features/**',
  '**/healing/**',
  '**/visual/**',
  '**/ai/**',
  '**/seed.spec.ts',
];
// Lighthouse audits launch their own browser with a debugging port, so they get a dedicated project.
const AUDITS = '**/audits/**';
// Performance specs read DevTools data (throttling, heap), so they run on Chromium only, in their own
// project, and only on request (PW_PERF=1, set by `pnpm test:perf`, which also passes --workers=1):
// measured alongside the rest of the suite, tests would slow each other down.
const PERF = '**/performance/**';
const perf = process.env.PW_PERF === '1';
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
  // Visual baselines are per operating system. On CI only the `visual` job compares them (PW_VISUAL=1):
  // it runs in the same Docker image that created the Linux baselines, so fonts and rendering match.
  ignoreSnapshots: env.CI && !process.env.PW_VISUAL,
  expect: {
    timeout: 7_000,
    // stylePath: CSS applied while every baseline screenshot is taken, to hide what changes on its own
    // (mark such elements data-visual="volatile").
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, stylePath: './tests/visual/screenshot.css' },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    ...(env.CI ? ([['blob'], ['github']] as const) : []),
    ...historyReporter(),
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
    // PW_WS_ENDPOINT=ws://host:port/ runs the browsers on a shared Playwright browser server
    // (`playwright run-server`, as in the Kubernetes setup) instead of launching them here.
    // The server must run the same Playwright version as this package. exposeNetwork tunnels the
    // remote browser's localhost traffic back to this machine, so specs that start a local server work.
    ...(process.env.PW_WS_ENDPOINT
      ? { connectOptions: { wsEndpoint: process.env.PW_WS_ENDPOINT, exposeNetwork: '<loopback>' } }
      : {}),
  },
  projects: [
    // Runs first: health-checks every target, then saves a logged-in session ...
    // ... and `cleanup` runs once after everything that needed setup has finished.
    { name: 'setup', testMatch: '**/health.setup.ts', teardown: 'cleanup' },
    { name: 'cleanup', testMatch: '**/cleanup.teardown.ts' },
    { name: 'auth', testMatch: '**/auth.setup.ts', dependencies: ['setup'] },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel },
      dependencies: ready,
      testIgnore: [AUDITS, PERF],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ready,
      testIgnore: [...LABS, AUDITS, PERF],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ready,
      testIgnore: [...LABS, AUDITS, PERF],
    },
    {
      name: 'lighthouse',
      use: { ...devices['Desktop Chrome'], channel },
      dependencies: ready,
      testMatch: AUDITS,
      timeout: 120_000,
      retries: 0,
    },
    ...(perf
      ? [
          {
            name: 'perf',
            use: { ...devices['Desktop Chrome'], channel },
            dependencies: ready,
            testMatch: PERF,
            // A retry would hide a slow run; budgets have headroom for network noise instead.
            retries: 0,
          },
        ]
      : []),
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, dependencies: ready, testMatch: '**/smoke/**' },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      dependencies: ready,
      testMatch: '**/smoke/**',
    },
    // A tablet: an iPad in WebKit, touch and a portrait viewport between phone and desktop.
    { name: 'tablet', use: { ...devices['iPad Pro 11'] }, dependencies: ready, testMatch: '**/smoke/**' },
    ...branded.map((name) => ({
      name,
      use: { ...devices['Desktop Chrome'], channel: name },
      dependencies: ready,
      testMatch: '**/smoke/**',
    })),
  ],
});
