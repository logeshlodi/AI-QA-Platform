import { outcomesOf, type AttemptStatus, type StoredRun } from '@aiqa/reporting-engine';

export const TRIAGE_LABELS = ['product', 'test', 'flaky', 'environment'] as const;
export type TriageLabel = (typeof TRIAGE_LABELS)[number];

export interface PastOutcome {
  outcome: 'passed' | 'failed' | 'flaky';
  /** First line of the error, when it failed. */
  error?: string;
}

/** Everything triage knows about one failed test. Built from the run history, or written by hand in an eval case. */
export interface TriageContext {
  testId: string;
  title: string;
  file: string;
  project: string;
  errorMessage: string;
  /** This run's attempts, first to last. ["failed", "passed"] passed on retry. */
  attempts: AttemptStatus[];
  /** Earlier runs of the same test, oldest first, at most 10. */
  previous: PastOutcome[];
  run: {
    id: string;
    suite: string;
    /** Tests that failed in this run (after retries), this one included. */
    failing: number;
    total: number;
    /** Other failing tests in this run whose error reads the same as this one. */
    sameError: number;
  };
  /** Other failures in the same run, at most 10, for the model's `run_failures` tool. */
  otherFailures: { title: string; error: string }[];
}

const ANSI = /\u001b\[[0-9;]*m/g;

/** The error's first line without colours. */
export const firstLine = (message = ''): string =>
  message.replace(ANSI, '').trim().split('\n')[0]?.trim() ?? '';

/** Errors that differ only in numbers, ids or quoted values read as the same error. */
export function errorSignature(message = ''): string {
  return firstLine(message)
    .replace(/(["'`]).*?\1/g, '"…"')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

/**
 * The failed and flaky tests of one run (the latest when `runId` is not given), each with its
 * history from earlier runs of the same suite.
 */
export function buildTriageContexts(history: StoredRun[], runId?: string): TriageContext[] {
  const ordered = [...history].sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt));
  const index = runId ? ordered.findIndex((r) => r.run.id === runId) : ordered.length - 1;
  const current = ordered[index];
  if (!current) return [];
  const earlier = ordered.slice(0, index).filter((r) => r.run.suite === current.run.suite);

  const outcomes = outcomesOf(current.results).filter((o) => o.outcome !== 'skipped');
  const failing = outcomes.filter((o) => o.outcome === 'failed');
  const toTriage = outcomes.filter((o) => o.outcome === 'failed' || o.outcome === 'flaky');

  return toTriage.map((o) => {
    const signature = errorSignature(o.errorMessage);
    const previous: PastOutcome[] = earlier
      .map((r) => outcomesOf(r.results).find((p) => p.testId === o.testId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.outcome !== 'skipped')
      .slice(-10)
      .map((p) => ({
        outcome: p.outcome as PastOutcome['outcome'],
        error: p.outcome === 'passed' ? undefined : firstLine(p.errorMessage),
      }));
    const attempts = current.results
      .filter((r) => r.testId === o.testId)
      .sort((a, b) => a.retry - b.retry)
      .map((r) => r.status);
    const others = failing.filter((f) => f.testId !== o.testId);
    return {
      testId: o.testId,
      title: o.title,
      file: o.file,
      project: o.project,
      errorMessage: o.errorMessage ?? '',
      attempts,
      previous,
      run: {
        id: current.run.id,
        suite: current.run.suite,
        failing: failing.length,
        total: outcomes.length,
        sameError: others.filter((f) => errorSignature(f.errorMessage) === signature).length,
      },
      otherFailures: others.slice(0, 10).map((f) => ({ title: f.title, error: firstLine(f.errorMessage) })),
    };
  });
}
