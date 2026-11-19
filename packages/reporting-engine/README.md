# @aiqa/reporting-engine

Run history, trends and flaky detection for the Playwright suites.

- `HistoryReporter` (`src/playwright-reporter.ts`): a Playwright reporter that writes every run to the
  run store (`test_run`, `test_result`) and rebuilds the dashboard. One writer, in the main process.
- Stores: SQLite on Node's built-in driver when available, otherwise one JSON file per run. Same
  `RunRepository` interface either way, picked by `createRunRepository`.
- Analysis (`src/analysis.ts`): outcomes per test after retries, run summaries, `detectFlaky`
  (passed only on retry, or flipped green/red at least twice across runs), slowest tests.
- `renderDashboard`: one self-contained HTML page with pass-rate and duration trends per suite,
  the flaky list, latest failures with their rule-based cause, and the run log.

Wired in `playwright.config.ts` of both frameworks; open `packages/<framework>/.aiqa/dashboard/index.html`
after a run, or `pnpm report:dashboard`.
