import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createRunRepository,
  DASHBOARD_DIR,
  HISTORY_DIR,
  renderDashboard,
  type ResultRecord,
} from '@aiqa/reporting-engine';

/**
 * `pnpm perf:load [smoke|load|stress]`: runs the k6 script against the order-service stack in k6's
 * Docker image, then records the key numbers in the run history (suite "load"), so `aiqa perf` and
 * the dashboard track them between runs like the browser metrics. Exits with k6's own code:
 * 0 when every threshold held, 99 when one was crossed.
 *
 * The stack must be up first (`pnpm stack:up`).
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');
const COMPOSE = path.join(ROOT, 'infrastructure', 'docker', 'stack.compose.yml');
const RESULTS = path.resolve(__dirname, '..', 'results');
const SUMMARY = path.join(RESULTS, 'summary.json');
const PROFILES = ['smoke', 'load', 'stress'];

/** The part of k6's --summary-export file this reads. */
interface K6Summary {
  metrics: Record<string, Record<string, number | undefined> | undefined>;
}

const round = (value: number | undefined) => (value === undefined ? undefined : Math.round(value * 10) / 10);

/** The numbers worth a trend line, named with their unit. Lower is better for all of them. */
export function keyMetrics(summary: K6Summary): Record<string, number> {
  const m = summary.metrics;
  const picked: Record<string, number | undefined> = {
    end_to_end_p50_ms: round(m.order_end_to_end?.med),
    end_to_end_p95_ms: round(m.order_end_to_end?.['p(95)']),
    post_order_p95_ms: round(m['http_req_duration{name:POST /orders}']?.['p(95)']),
    get_order_p95_ms: round(m['http_req_duration{name:GET /orders/:id}']?.['p(95)']),
    // Rates as percentages, so 20% tolerance means something.
    failed_requests_pct: round((m.http_req_failed?.value ?? 0) * 100),
    unconfirmed_orders_pct: round((1 - (m.orders_confirmed?.value ?? 1)) * 100),
    // Orders k6 could not start because every virtual user was busy: the system fell behind.
    dropped_orders: m.dropped_iterations?.count ?? 0,
  };
  return Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== undefined)) as Record<
    string,
    number
  >;
}

function record(profile: string, exitCode: number, startedAt: Date): void {
  const summary = fs.existsSync(SUMMARY)
    ? (JSON.parse(fs.readFileSync(SUMMARY, 'utf8')) as K6Summary)
    : undefined;
  const runId = randomUUID();
  const passed = exitCode === 0;
  const result: ResultRecord = {
    runId,
    testId: `k6-order-flow-${profile}`,
    retry: 0,
    title: `order flow under the ${profile} profile`,
    file: 'packages/load-tests/scripts/order-flow.js',
    project: 'k6',
    status: passed ? 'passed' : 'failed',
    durationMs: Date.now() - startedAt.getTime(),
    errorMessage: passed
      ? undefined
      : exitCode === 99
        ? 'k6: a threshold was crossed (see the k6 output for which)'
        : `k6 exited with code ${exitCode}`,
    failureCategory: passed ? undefined : exitCode === 99 ? 'performance' : 'infrastructure',
    metrics: summary ? keyMetrics(summary) : undefined,
  };
  const repo = createRunRepository(HISTORY_DIR);
  try {
    repo.saveRun({
      run: {
        id: runId,
        suite: 'load',
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        environment: process.env.CI ? 'ci' : 'local',
        gitSha: process.env.GITHUB_SHA,
        branch: process.env.GITHUB_REF_NAME,
      },
      results: [result],
    });
    fs.mkdirSync(DASHBOARD_DIR, { recursive: true });
    fs.writeFileSync(path.join(DASHBOARD_DIR, 'index.html'), renderDashboard(repo.listRuns(50)));
  } finally {
    repo.close();
  }
  if (result.metrics) console.log(`Recorded in the run history: ${JSON.stringify(result.metrics)}`);
}

function main(): void {
  const profile = process.argv[2] ?? process.env.K6_PROFILE ?? 'smoke';
  if (!PROFILES.includes(profile))
    throw new Error(`Unknown profile "${profile}". Use one of: ${PROFILES.join(', ')}`);
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.rmSync(SUMMARY, { force: true });
  const startedAt = new Date();
  const k6 = spawnSync(
    'docker',
    ['compose', '-f', COMPOSE, '--profile', 'perf', 'run', '--rm', '-e', `PROFILE=${profile}`, 'k6'],
    { stdio: 'inherit', cwd: ROOT },
  );
  if (k6.error) throw new Error(`Could not start docker: ${k6.error.message}. Is Docker running?`);
  const exitCode = k6.status ?? 1;
  record(profile, exitCode, startedAt);
  process.exitCode = exitCode;
}

if (require.main === module) main();
