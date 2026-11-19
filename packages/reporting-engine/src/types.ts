/** Status of one attempt, as Playwright reports it. */
export type AttemptStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

/** One execution of a suite: `pnpm test:ui` once is one run. */
export interface RunRecord {
  id: string;
  /** Which suite ran: "ui", "api", or any name the reporter was given. */
  suite: string;
  startedAt: string;
  finishedAt: string;
  environment: string;
  gitSha?: string;
  branch?: string;
}

/** One attempt of one test. A test retried twice has three of these in a run. */
export interface ResultRecord {
  runId: string;
  testId: string;
  retry: number;
  title: string;
  file: string;
  project: string;
  status: AttemptStatus;
  durationMs: number;
  errorMessage?: string;
  failureCategory?: string;
  /** Numbers the test recorded with `metric` annotations, e.g. { lcp_ms: 412, transfer_bytes: 337291 }. */
  metrics?: Record<string, number>;
}

export interface StoredRun {
  run: RunRecord;
  results: ResultRecord[];
}
