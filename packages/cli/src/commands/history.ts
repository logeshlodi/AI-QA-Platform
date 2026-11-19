import { detectFlaky, HISTORY_DIR, openRunHistory, summarize, type StoredRun } from '@aiqa/reporting-engine';

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
