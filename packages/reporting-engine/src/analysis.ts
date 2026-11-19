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
