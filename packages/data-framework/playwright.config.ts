import { consoleReporter, historyReporter } from '@aiqa/reporting-engine';
import { defineConfig } from '@playwright/test';
import { loadEnv } from '@aiqa/shared';
import { readEnvironments, type Environment } from './src/environments';

const env = loadEnv();

/** No browser here: Playwright's runner, fixtures, retries and reports, pointed at a database and a broker. */
export default defineConfig<object, { environment: Environment }>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: [
    ...consoleReporter(),
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    ...historyReporter(),
  ],
  projects: [
    { name: 'stack', testMatch: /setup\/.*\.setup\.ts/ },
    { name: 'data', dependencies: ['stack'], testIgnore: [/setup\//, /environments\//] },
    // `pnpm test:matrix`: the environment smoke, once per environment, all in this one run.
    ...(process.env.AIQA_MATRIX
      ? readEnvironments().map((environment) => ({
          name: `env-${environment.name}`,
          testMatch: /environments\/.*\.spec\.ts/,
          use: { environment },
        }))
      : []),
  ],
});
