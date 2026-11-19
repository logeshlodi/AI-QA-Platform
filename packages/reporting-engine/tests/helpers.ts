import type { AttemptStatus, ResultRecord, StoredRun } from '../src';

let clock = Date.parse('2026-11-01T10:00:00Z');

/** Builds a run. Each test is `id: statuses`, one status per attempt: `{ a: ['failed', 'passed'] }` = flaky. */
export function run(tests: Record<string, AttemptStatus[]>, suite = 'ui'): StoredRun {
  const startedAt = new Date(clock).toISOString();
  clock += 60 * 60_000;
  const id = `run-${startedAt}`;
  const results: ResultRecord[] = Object.entries(tests).flatMap(([testId, attempts]) =>
    attempts.map((status, retry) => ({
      runId: id,
      testId,
      retry,
      title: `test ${testId}`,
      file: `tests/${testId}.spec.ts`,
      project: 'chromium',
      status,
      durationMs: 1000 * (retry + 1),
      errorMessage: status === 'failed' ? `Error: ${testId} broke` : undefined,
      failureCategory: status === 'failed' ? 'test' : undefined,
    })),
  );
  return {
    run: {
      id,
      suite,
      startedAt,
      finishedAt: new Date(clock - 59 * 60_000).toISOString(),
      environment: 'local',
    },
    results,
  };
}
