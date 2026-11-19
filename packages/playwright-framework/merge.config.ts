import { historyReporter } from '@aiqa/reporting-engine';
import { defineConfig } from '@playwright/test';

/**
 * Used only by `playwright merge-reports` in CI: the UI suite runs in three shards, and each shard
 * is a slice of the suite, so history is recorded once, here, from the merged shards.
 */
export default defineConfig({
  testDir: './tests',
  reporter: [['html', { open: 'never' }], ...historyReporter('ui')],
});
