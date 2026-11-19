import type { ResultRecord, StoredRun } from './types';

/** What finally happened to a test in one run, after all its retries. */
export type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface TestOutcome {
  testId: string;
  title: string;
  file: string;
  project: string;
  outcome: Outcome;
  attempts: number;
  /** Time spent across every attempt. */
  durationMs: number;
  errorMessage?: string;
  failureCategory?: string;
}

/** Collapses attempts into one outcome per test. Passing only after a failed attempt is "flaky". */
export function outcomesOf(results: ResultRecord[]): TestOutcome[] {
  const byTest = new Map<string, ResultRecord[]>();
  for (const result of results) {
    const list = byTest.get(result.testId);
    if (list) list.push(result);
    else byTest.set(result.testId, [result]);
  }
  return [...byTest.values()].map((attempts) => {
    attempts.sort((a, b) => a.retry - b.retry);
    const last = attempts[attempts.length - 1] as ResultRecord;
    const failedBefore = attempts.slice(0, -1).some((a) => a.status !== 'passed' && a.status !== 'skipped');
    const outcome: Outcome =
      last.status === 'skipped'
        ? 'skipped'
        : last.status !== 'passed'
          ? 'failed'
          : failedBefore
            ? 'flaky'
            : 'passed';
    const firstFailure = attempts.find((a) => a.errorMessage);
    return {
      testId: last.testId,
      title: last.title,
      file: last.file,
      project: last.project,
      outcome,
      attempts: attempts.length,
      durationMs: attempts.reduce((sum, a) => sum + a.durationMs, 0),
      errorMessage: outcome === 'passed' ? undefined : firstFailure?.errorMessage,
      failureCategory: outcome === 'passed' ? undefined : firstFailure?.failureCategory,
    };
  });
}

export interface RunSummary {
  runId: string;
  suite: string;
  startedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  /** Share of executed tests that ended green, 0 to 100. A flaky test counts as green. */
  passRate: number;
}

export function summarize(stored: StoredRun): RunSummary {
  const outcomes = outcomesOf(stored.results);
  const count = (outcome: Outcome) => outcomes.filter((o) => o.outcome === outcome).length;
  const passed = count('passed');
  const flaky = count('flaky');
  const failed = count('failed');
  const executed = passed + flaky + failed;
  return {
    runId: stored.run.id,
    suite: stored.run.suite,
    startedAt: stored.run.startedAt,
    durationMs: Math.max(0, Date.parse(stored.run.finishedAt) - Date.parse(stored.run.startedAt)),
    total: outcomes.length,
    passed,
    failed,
    flaky,
    skipped: count('skipped'),
    passRate: executed === 0 ? 100 : Math.round(((passed + flaky) / executed) * 1000) / 10,
  };
}

export interface FlakyTest {
  testId: string;
  title: string;
  file: string;
  project: string;
  /** Runs in the window where the test executed. */
  runs: number;
  failures: number;
  /** Runs where it passed only on a retry. */
  retriedPasses: number;
  /** Changes between green and red from one run to the next. */
  flips: number;
  /** (flips + retriedPasses) / runs, capped at 1. Higher is less trustworthy. */
  score: number;
  lastOutcome: Outcome;
}

export interface FlakyOptions {
  /** Runs needed before flips between runs count. Default 3. */
  minRuns?: number;
  /** How many of the most recent runs to look at. Default 20. */
  window?: number;
}

/**
 * Finds tests whose result cannot be trusted. Two signals:
 *  - it passed only after a retry in some run, or
 *  - across runs it went green, red, green (two or more flips).
 * One flip is not flaky: green then red and staying red is a regression, and belongs in the failure list.
 */
export function detectFlaky(history: StoredRun[], options: FlakyOptions = {}): FlakyTest[] {
  const minRuns = options.minRuns ?? 3;
  const recent = [...history]
    .sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt))
    .slice(-(options.window ?? 20));

  const perTest = new Map<string, TestOutcome[]>();
  for (const stored of recent) {
    for (const outcome of outcomesOf(stored.results)) {
      if (outcome.outcome === 'skipped') continue;
      const list = perTest.get(outcome.testId);
      if (list) list.push(outcome);
      else perTest.set(outcome.testId, [outcome]);
    }
  }

  const flaky: FlakyTest[] = [];
  for (const outcomes of perTest.values()) {
    const green = outcomes.map((o) => o.outcome !== 'failed');
    const flips = green.filter((value, i) => i > 0 && value !== green[i - 1]).length;
    const retriedPasses = outcomes.filter((o) => o.outcome === 'flaky').length;
    if (retriedPasses === 0 && (outcomes.length < minRuns || flips < 2)) continue;
    const last = outcomes[outcomes.length - 1] as TestOutcome;
    flaky.push({
      testId: last.testId,
      title: last.title,
      file: last.file,
      project: last.project,
      runs: outcomes.length,
      failures: green.filter((value) => !value).length,
      retriedPasses,
      flips,
      score: Math.min(1, Math.round(((flips + retriedPasses) / outcomes.length) * 100) / 100),
      lastOutcome: last.outcome,
    });
  }
  return flaky.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export const slowest = (outcomes: TestOutcome[], count = 10): TestOutcome[] =>
  outcomes
    .filter((o) => o.outcome !== 'skipped')
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, count);

export type TrendVerdict = 'regressed' | 'improved' | 'steady' | 'new';

export interface MetricTrend {
  testId: string;
  title: string;
  file: string;
  project: string;
  metric: string;
  /** Value in the most recent run that recorded this metric. */
  latest: number;
  /** Median of the previous runs in the window; undefined when there are none yet. */
  baseline?: number;
  /** (latest - baseline) / baseline, e.g. 0.25 for 25% higher. */
  change?: number;
  verdict: TrendVerdict;
  /** Values oldest first, the latest included: enough for a sparkline. */
  values: number[];
}

export interface TrendOptions {
  /** How many earlier runs form the baseline. Default 10. */
  baselineRuns?: number;
  /** Relative change that counts as a regression or improvement. Default 0.2 (20%). */
  tolerance?: number;
  /** Changes smaller than this, in the metric's own unit, are noise whatever the percentage. Default 0. */
  minAbsoluteChange?: number;
  /** Earlier runs needed before a verdict; until then the metric is "new". Default 3. */
  minBaselineRuns?: number;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/**
 * Performance trends: for every metric a test records, compares its latest value with the median of
 * the runs before it. The median, not the mean, so one slow run in the baseline does not move it.
 *
 * Lower is better for every metric recorded here (times, bytes, layout shift, heap growth), so a rise
 * beyond the tolerance is a regression. Only each test's final attempt counts, and only when it ran.
 */
export function metricTrends(history: StoredRun[], options: TrendOptions = {}): MetricTrend[] {
  const baselineRuns = options.baselineRuns ?? 10;
  const tolerance = options.tolerance ?? 0.2;
  const minAbsolute = options.minAbsoluteChange ?? 0;
  // A median of one or two runs is one or two runs: too few to call anything a regression.
  const minBaseline = Math.min(options.minBaselineRuns ?? 3, baselineRuns);
  const runs = [...history].sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt));

  type Series = { info: ResultRecord; values: number[] };
  const series = new Map<string, Series>();
  for (const stored of runs) {
    const lastAttempt = new Map<string, ResultRecord>();
    for (const result of stored.results) {
      const seen = lastAttempt.get(result.testId);
      if (!seen || result.retry > seen.retry) lastAttempt.set(result.testId, result);
    }
    for (const result of lastAttempt.values()) {
      if (result.status === 'skipped' || !result.metrics) continue;
      for (const [metric, value] of Object.entries(result.metrics)) {
        const key = `${result.testId}\u0000${metric}`;
        const entry = series.get(key) ?? { info: result, values: [] };
        entry.info = result;
        entry.values.push(value);
        series.set(key, entry);
      }
    }
  }

  const trends: MetricTrend[] = [];
  for (const [key, { info, values }] of series) {
    const metric = key.split('\u0000')[1] as string;
    const latest = values[values.length - 1] as number;
    const earlier = values.slice(0, -1).slice(-baselineRuns);
    const base = {
      testId: info.testId,
      title: info.title,
      file: info.file,
      project: info.project,
      metric,
      latest,
    };
    if (earlier.length === 0) {
      trends.push({ ...base, verdict: 'new', values });
      continue;
    }
    const baseline = median(earlier);
    const delta = latest - baseline;
    const change = baseline === 0 ? (latest === 0 ? 0 : Infinity) : delta / baseline;
    const significant = Math.abs(delta) > minAbsolute && Math.abs(change) > tolerance;
    const verdict: TrendVerdict =
      earlier.length < minBaseline ? 'new' : !significant ? 'steady' : delta > 0 ? 'regressed' : 'improved';
    trends.push({ ...base, baseline, change, verdict, values });
  }
  const order: Record<TrendVerdict, number> = { regressed: 0, improved: 1, new: 2, steady: 3 };
  return trends.sort(
    (a, b) =>
      order[a.verdict] - order[b.verdict] ||
      a.title.localeCompare(b.title) ||
      a.metric.localeCompare(b.metric),
  );
}
