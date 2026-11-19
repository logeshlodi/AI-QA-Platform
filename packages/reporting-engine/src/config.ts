import path from 'node:path';
import type { HistoryReporterOptions } from './playwright-reporter';

/** Repository root: packages/reporting-engine/src -> ../../.. */
const ROOT = path.resolve(__dirname, '..', '..', '..');

/** Where every suite keeps its history and where the combined dashboard is written. */
export const HISTORY_DIR = path.join(ROOT, '.aiqa', 'history');
export const DASHBOARD_DIR = path.join(ROOT, '.aiqa', 'dashboard');
export const HISTORY_REPORTER = path.join(__dirname, 'playwright-reporter.ts');

/**
 * The reporter entry for a Playwright config, or nothing.
 * History is recorded only when AIQA_HISTORY names the suite (set by `pnpm test:ui` and
 * `pnpm test:api`), so a quick run of one spec does not drag the trend lines around.
 */
export function historyReporter(suite = process.env.AIQA_HISTORY): [] | [[string, HistoryReporterOptions]] {
  if (!suite) return [];
  return [[HISTORY_REPORTER, { suite, historyDir: HISTORY_DIR, dashboardDir: DASHBOARD_DIR }]];
}
