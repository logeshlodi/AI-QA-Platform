import { defineConfig, devices } from '@playwright/test';

/**
 * The labs. Each folder under labs/ has an exercise (a planted mistake: it fails, or passes when it
 * should not) and a solution. `pnpm lab 03` runs one exercise; `pnpm test:labs` runs every solution,
 * which CI does, so a lab can never silently stop teaching what it says.
 */
export default defineConfig({
  testDir: './labs',
  timeout: 30_000,
  retries: 0, // a retry would hide exactly what some labs are about
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    testIdAttribute: 'data-test', // SauceDemo's test ids
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'exercise', testMatch: '**/exercise.spec.ts' },
    { name: 'solution', testMatch: '**/solution.spec.ts' },
  ],
});
