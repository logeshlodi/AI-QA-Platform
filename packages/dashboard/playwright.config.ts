import { defineConfig, devices } from '@playwright/test';

const GALLERY = 'http://localhost:3100/playwright/gallery/index.html';

/**
 * Component tests on Playwright's stories model: no component-testing package, only the built-in
 * `mount` fixture driving the gallery that Vite serves. Visual specs are tagged @visual and compare
 * against Linux baselines made in the Playwright Docker image, like the UI suite's.
 */
export default defineConfig({
  testDir: './tests/components',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  // Screenshots differ between operating systems; off unless PW_VISUAL=1 (the Linux image and CI).
  grepInvert: process.env.PW_VISUAL ? undefined : /@visual/,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: { baseURL: GALLERY, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'components',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1000, height: 720 },
        serviceWorkers: 'block',
        reuseContext: true,
        // Only for machines that cannot download Playwright's browser build; unset everywhere else.
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    command: 'pnpm exec vite --config playwright/vite.config.mts',
    url: GALLERY,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
