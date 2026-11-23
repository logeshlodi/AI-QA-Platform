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
/** Playwright's console reporters this repository allows. */
export const CONSOLE_REPORTERS = ['list', 'line', 'dot'] as const;
export type ConsoleReporter = (typeof CONSOLE_REPORTERS)[number];

/**
 * The console reporter: `list` (one line per test, the default), `line` (one line that updates:
 * quiet output for long runs) or `dot` (one character per test: CI logs that stay short).
 * Chosen with PW_CONSOLE_REPORTER; the file reporters (HTML, JUnit, history) are unaffected.
 */
export function consoleReporter(value = process.env.PW_CONSOLE_REPORTER): [[ConsoleReporter]] {
  if (!value) return [['list']];
  if (!(CONSOLE_REPORTERS as readonly string[]).includes(value))
    throw new Error(`PW_CONSOLE_REPORTER must be one of ${CONSOLE_REPORTERS.join(', ')}; got "${value}".`);
  return [[value as ConsoleReporter]];
}

export function historyReporter(suite = process.env.AIQA_HISTORY): [] | [[string, HistoryReporterOptions]] {
  if (!suite) return [];
  return [[HISTORY_REPORTER, { suite, historyDir: HISTORY_DIR, dashboardDir: DASHBOARD_DIR }]];
}
