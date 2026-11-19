import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { classifyByRules } from '@aiqa/ai-engine';
import { renderDashboard } from './dashboard';
import { createRunRepository, type RunStoreKind } from './store/factory';
import type { ResultRecord } from './types';

export interface HistoryReporterOptions {
  /** Name shown on the dashboard: "ui", "api". Default "tests". */
  suite?: string;
  /** Folder for the run history. Default <cwd>/.aiqa/history. */
  historyDir?: string;
  /** Folder for the generated dashboard (index.html). Default: "dashboard" next to historyDir. */
  dashboardDir?: string;
  /** How many recent runs the dashboard reads. Default 50. */
  keepRuns?: number;
  store?: RunStoreKind;
}

const ANSI = /\u001b\[[0-9;]*m/g;

const git = (...args: string[]): string | undefined => {
  try {
    return (
      execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined
    );
  } catch {
    return undefined;
  }
};

/**
 * Playwright reporter that keeps history: every run is written to the run store
 * (test_run and test_result), then the dashboard is rebuilt from the stored runs.
 * It runs in Playwright's main process, so there is one writer however many workers run.
 * A reporter must never fail a test run: any error here is printed and swallowed.
 */
export default class HistoryReporter implements Reporter {
  private readonly runId = randomUUID();
  private readonly results: ResultRecord[] = [];
  private startedAt = new Date();
  private rootDir = process.cwd();

  constructor(private readonly options: HistoryReporterOptions = {}) {}

  onBegin(config: FullConfig): void {
    this.startedAt = new Date();
    // Paths relative to the package (where the config lives), e.g. tests/journeys/checkout.spec.ts.
    this.rootDir = config.configFile ? path.dirname(config.configFile) : config.rootDir;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const failed = result.status === 'failed' || result.status === 'timedOut';
    const errorMessage = failed ? (result.error?.message ?? '').replace(ANSI, '').slice(0, 2000) : undefined;
    this.results.push({
      runId: this.runId,
      testId: test.id,
      retry: result.retry,
      // titlePath is ['', project, file, ...describe blocks, test title]
      title: test.titlePath().slice(3).join(' › '),
      file: path.relative(this.rootDir, test.location.file).replaceAll('\\', '/'),
      project: test.parent.project()?.name ?? '',
      status: result.status,
      durationMs: Math.round(result.duration),
      errorMessage: errorMessage || undefined,
      failureCategory: failed
        ? (classifyByRules({ errorMessage: errorMessage ?? '' })?.category ?? 'unknown')
        : undefined,
    });
  }

  onEnd(): void {
    try {
      const historyDir = this.options.historyDir ?? path.join(process.cwd(), '.aiqa', 'history');
      const dashboardDir = this.options.dashboardDir ?? path.join(path.dirname(historyDir), 'dashboard');
      const repository = createRunRepository(historyDir, this.options.store);
      try {
        repository.saveRun({
          run: {
            id: this.runId,
            suite: this.options.suite ?? 'tests',
            startedAt: this.startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            environment: process.env.CI ? 'ci' : 'local',
            gitSha: process.env.GITHUB_SHA ?? git('rev-parse', 'HEAD'),
            branch: process.env.GITHUB_REF_NAME ?? git('rev-parse', '--abbrev-ref', 'HEAD'),
          },
          results: this.results,
        });
        fs.mkdirSync(dashboardDir, { recursive: true });
        fs.writeFileSync(
          path.join(dashboardDir, 'index.html'),
          renderDashboard(repository.listRuns(this.options.keepRuns ?? 50)),
        );
      } finally {
        repository.close();
      }
    } catch (error) {
      console.warn(`[history-reporter] run history was not saved: ${(error as Error).message}`);
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}
