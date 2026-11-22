import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { VIEWER_STATE } from './tests/e2e/users';

// Not 3000: the stack's Grafana is there (and also answers /healthz).
const PORT = 3200;
const APP_URL = `http://localhost:${PORT}`;
const DATA = path.resolve(__dirname, 'tests', '.fixture-data');

/** The app reads the fixed fixture data set, never the laptop's own history, so numbers are exact. */
const appEnv = {
  APP_URL,
  SESSION_SECRET: 'test-only-session-secret-0123456789abcdef',
  AIQA_HISTORY_DIR: path.join(DATA, 'history'),
  AIQA_HEAL_DIR: path.join(DATA, 'heals'),
  AIQA_AGENT_LOG: path.join(DATA, 'agents', 'runs.jsonl'),
};

/**
 * End-to-end and accessibility specs for the web app. Sign-in goes through the stack's real Keycloak
 * (pnpm stack:up, or only Keycloak: docker compose -f infrastructure/docker/stack.compose.yml up -d --wait keycloak).
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    // Only for machines that cannot download Playwright's browser build; unset everywhere else.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'sign-in', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      // Specs that sign in and out themselves start with no session.
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'dashboard',
      testMatch: /(dashboard|a11y)\.spec\.ts/,
      dependencies: ['sign-in'],
      use: { ...devices['Desktop Chrome'], storageState: VIEWER_STATE },
    },
  ],
  webServer: {
    // PW_WEB_DEV=1 runs next dev (fast edits); otherwise a production build, as CI does.
    command: process.env.PW_WEB_DEV
      ? `pnpm seed && pnpm exec next dev --port ${PORT}`
      : `pnpm seed && pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: `${APP_URL}/healthz`,
    env: appEnv,
    // Never reuse: a different app on the port (Grafana once was) must fail loudly, not be tested.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
