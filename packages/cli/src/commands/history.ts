import {
  detectFlaky,
  formatMetric,
  HISTORY_DIR,
  openRunHistory,
  summarize,
  type MetricTrend,
  type StoredRun,
} from '@aiqa/reporting-engine';

const pad = (value: string | number, width: number): string => String(value).padEnd(width);
const when = (iso: string): string => iso.replace('T', ' ').slice(0, 16);

export function loadRuns(dir = HISTORY_DIR, limit = 50): StoredRun[] {
  const repo = openRunHistory(dir); // read-only: works on history this user does not own
  try {
    return repo.listRuns(limit);
  } finally {
    repo.close();
  }
}

/** The run log as a plain-text table, newest first. */
export function formatHistory(runs: StoredRun[], suite?: string, limit = 15): string {
  const rows = runs
    .filter((r) => !suite || r.run.suite === suite)
    .reverse()
    .slice(0, limit)
    .map(summarize);
  if (rows.length === 0) return 'No runs recorded. Run "pnpm test:api" or "pnpm test:ui" first.';
  const head = `${pad('Started (UTC)', 18)}${pad('Suite', 7)}${pad('Tests', 7)}${pad('Failed', 8)}${pad('Flaky', 7)}Pass rate`;
  return [
    head,
    ...rows.map(
      (s) =>
        `${pad(when(s.startedAt), 18)}${pad(s.suite, 7)}${pad(s.total, 7)}${pad(s.failed, 8)}${pad(s.flaky, 7)}${s.passRate}%`,
    ),
  ].join('\n');
}

export function formatFlaky(runs: StoredRun[]): string {
  if (runs.length === 0) return 'No runs recorded yet, so nothing to judge.';
  const flaky = detectFlaky(runs);
  if (flaky.length === 0) return `No flaky tests in the last ${Math.min(runs.length, 20)} runs.`;
  return flaky
    .map(
      (f) =>
        `${f.score.toFixed(2)}  ${f.title}  [${f.project}]\n      ${f.file}: ${f.runs} runs, ${f.failures} failed, ${f.retriedPasses} passed on retry, ${f.flips} flips`,
    )
    .join('\n');
}

const VERDICT_LABEL: Record<MetricTrend['verdict'], string> = {
  regressed: 'REGRESSED',
  improved: 'improved',
  steady: 'steady',
  new: 'new',
};

/**
 * Performance metrics against their usual level. Steady metrics are left out unless `all` is set,
 * so the output is the list of things worth looking at.
 */
export function formatPerf(trends: MetricTrend[], all = false): string {
  if (trends.length === 0) return 'No performance metrics recorded. Run "pnpm test:perf" first.';
  const shown = all ? trends : trends.filter((t) => t.verdict !== 'steady');
  const steady = trends.length - shown.length;
  if (shown.length === 0) return `All ${trends.length} metrics are steady (within 20% of their median).`;
  const lines = shown.map((t) => {
    const usual =
      t.baseline === undefined ? 'no baseline yet' : `usual ${formatMetric(t.metric, t.baseline)}`;
    const change =
      t.change === undefined
        ? ''
        : Number.isFinite(t.change)
          ? ` (${t.change > 0 ? '+' : ''}${Math.round(t.change * 100)}%)`
          : '';
    return `${pad(VERDICT_LABEL[t.verdict], 10)}${t.title}  [${t.project}]\n          ${t.metric}: ${formatMetric(t.metric, t.latest)}, ${usual}${change}`;
  });
  if (steady > 0)
    lines.push(`... and ${steady} steady metric${steady === 1 ? '' : 's'} (--all to list them).`);
  return lines.join('\n');
}
