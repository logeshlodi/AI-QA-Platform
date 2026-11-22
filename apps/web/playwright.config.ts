import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { ADMIN_STATE, VIEWER_STATE } from './tests/e2e/users';

// Not 3000: the stack's Grafana is there (and also answers /healthz).
const PORT = 3200;
const MODEL_PORT = 3299;
const APP_URL = `http://localhost:${PORT}`;
const DATA = path.resolve(__dirname, 'tests', '.fixture-data');

/**
 * The app reads the fixed fixture data set, never the laptop's own history, and answers chat
 * questions with the stub model (tests/fixtures/model-stub.ts), never a real one.
 */
const appEnv = {
  APP_URL,
  SESSION_SECRET: 'test-only-session-secret-0123456789abcdef',
  AIQA_HISTORY_DIR: path.join(DATA, 'history'),
  AIQA_HEAL_DIR: path.join(DATA, 'heals'),
  AIQA_AGENT_LOG: path.join(DATA, 'agents', 'runs.jsonl'),
  AIQA_CHAT_LOG: path.join(DATA, 'agents', 'chat.jsonl'),
  AIQA_QUARANTINE_FILE: path.join(DATA, 'quarantine.json'),
  AIQA_WEB_SETTINGS: path.join(DATA, 'web-settings.json'),
  AGENT_PROVIDER: 'openai-compatible',
  AGENT_BASE_URL: `http://localhost:${MODEL_PORT}/v1`,
  AGENT_MODEL: 'stub',
  AGENT_API_KEY: 'test-only-not-a-key',
};

/**
 * End-to-end, accessibility and AI-feature specs for the web app. Sign-in goes through the stack's
 * real Keycloak (pnpm stack:up, or only Keycloak: docker compose -f infrastructure/docker/stack.compose.yml up -d --wait keycloak).
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
      testMatch: /(dashboard|a11y|chat)\.spec\.ts/,
      dependencies: ['sign-in'],
      use: { ...devices['Desktop Chrome'], storageState: VIEWER_STATE },
    },
    {
      // Last: it changes the chat settings (writes off and on), which the chat specs read.
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      dependencies: ['sign-in', 'dashboard'],
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
    },
  ],
  webServer: [
    {
      command: 'pnpm model-stub',
      url: `http://localhost:${MODEL_PORT}/health`,
      env: { MODEL_STUB_PORT: String(MODEL_PORT) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
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
  ],
});
