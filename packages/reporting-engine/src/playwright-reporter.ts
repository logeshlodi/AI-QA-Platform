import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { classifyByRules } from '@aiqa/ai-engine';
import { renderDashboard } from './dashboard';
import { pushRunMetrics } from './push';
import { createRunRepository, type RunStoreKind } from './store/factory';
import type { ResultRecord, StoredRun } from './types';

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
  /** Pushgateway to send the run's metrics to. Default: the AIQA_PUSHGATEWAY environment variable. */
  pushgateway?: string;
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
/** Annotation type tests record numbers with (see `recordMetrics` in playwright-framework). */
export const METRIC_ANNOTATION = 'metric';

/** Reads `metric` annotations ("name=value"). Later values of the same name win. */
export function metricsOf(
  annotations: { type: string; description?: string }[],
): Record<string, number> | undefined {
  const metrics: Record<string, number> = {};
  for (const { type, description } of annotations) {
    if (type !== METRIC_ANNOTATION || !description) continue;
    const at = description.lastIndexOf('=');
    const value = Number(description.slice(at + 1));
    if (at > 0 && Number.isFinite(value)) metrics[description.slice(0, at).trim()] = value;
  }
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

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
    const metrics = metricsOf([...test.annotations, ...result.annotations]);
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
      metrics,
    });
  }

  async onEnd(): Promise<void> {
    let saved: { run: StoredRun; history: StoredRun[] } | undefined;
    try {
      const historyDir = this.options.historyDir ?? path.join(process.cwd(), '.aiqa', 'history');
      const dashboardDir = this.options.dashboardDir ?? path.join(path.dirname(historyDir), 'dashboard');
      const repository = createRunRepository(historyDir, this.options.store);
      try {
        const run: StoredRun = {
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
        };
        repository.saveRun(run);
        const history = repository.listRuns(this.options.keepRuns ?? 50);
        fs.mkdirSync(dashboardDir, { recursive: true });
        fs.writeFileSync(path.join(dashboardDir, 'index.html'), renderDashboard(history));
        saved = { run, history };
      } finally {
        repository.close();
      }
    } catch (error) {
      console.warn(`[history-reporter] run history was not saved: ${(error as Error).message}`);
    }
    // AIQA_PUSHGATEWAY=http://host:9091 also sends the run to Prometheus for Grafana (test monitoring).
    const gateway = this.options.pushgateway ?? process.env.AIQA_PUSHGATEWAY;
    if (gateway && saved) await pushRunMetrics(gateway, saved.run, saved.history);
  }

  printsToStdio(): boolean {
    return false;
  }
}
