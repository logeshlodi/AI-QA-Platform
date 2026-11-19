# Status

Last full run: 19 Nov 2026, Windows laptop (Dell Latitude 7420), Node 23.3.0, Playwright 1.65.0 (1.65.1 since PR #6).
Sprints 1 to 8 of the plan are built and have run on the laptop. Sprint 9 onward (agents, chat app, Kubernetes, learning content) is not started.

## What was run, and the result

| Check                                                                    | Where                                       | Result                                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Type-check (`pnpm typecheck`)                                            | Windows laptop and Linux workspace          | Clean                                                                                                                 |
| Lint (`pnpm lint`)                                                       | Windows laptop and Linux workspace          | 0 errors, 4 warnings                                                                                                  |
| Unit tests (`pnpm test:unit`)                                            | Linux workspace, Node 22                    | 132 passed                                                                                                            |
| Unit tests (`pnpm test:unit`)                                            | Windows laptop, Node 23.3                   | All 11 files passed; the 6 SQLite store contracts skip (see below)                                                    |
| API specs (`pnpm test:api`)                                              | Windows laptop, live APIs                   | 18 passed, twice, both recorded in the run history                                                                    |
| UI specs (`pnpm test:ui`)                                                | Windows laptop, live sites                  | 143 tests: 141 passed, 2 skipped on purpose (19 Nov); 1 Firefox flake on 15 Nov                                       |
| Live model tests (`pnpm test:ai`)                                        | Windows laptop, `qwen2.5-coder:7b`          | 4 passed: failure analysis, bug report, locator generation, test data                                                 |
| Generated-data API spec with `AI_ENABLED=true`                           | Windows laptop, live API                    | Passed; the booking was written by the model, accepted and read back unchanged                                        |
| Data suites (`pnpm test:data`) against the Docker stack                  | Windows laptop, Docker Desktop              | 24 passed after one fix (metrics exporter bound to localhost)                                                         |
| One command (`pnpm stack:test`): build, start, test in a container, stop | Windows laptop, Docker Desktop              | 24 passed, exit code 0                                                                                                |
| Prometheus and Grafana                                                   | Windows laptop, Docker Desktop              | Target up; counters matched the run (2 confirmed, 2 rejected, 4 dead-lettered, 1 duplicate); dashboard checked by eye |
| `aiqa new page --url` generator                                          | Linux workspace, local copy of a login page | Page object and spec written, formatted, lint-clean; the generated spec passed                                        |
| Run-history dashboard                                                    | Windows laptop                              | Built from the three recorded runs, branch and commit captured; checked by eye                                        |
| Smoke in Chrome and Edge                                                 | Windows laptop                              | 4 passed in each                                                                                                      |
| Lighthouse audit (`pnpm test:lighthouse`)                                | Windows laptop                              | Passed against the score floors                                                                                       |
| Linux visual baseline (Docker `snapshots`)                               | Windows laptop, Docker Desktop              | Created `login-form-chromium-linux.png`                                                                               |
| GitHub Actions                                                           | GitHub                                      | Green on the initial commit and on the pnpm update; later pushes not checked from here                                |

On 15 Nov the Firefox checkout journey timed out on the Finish click during the full
four-worker run. The same spec then passed three times in a row on its own, so it is recorded as a
load-related flake on this laptop, not fixed. On 19 Nov it passed in the full run. CI retries failed tests twice; local runs do not retry.

The two skips are deliberate: the `test.fixme` demo, and the model tie-break spec, which skips unless
`AI_ENABLED=true`. That spec covers the fifth AI task and passed with the model on 13 Nov.

## Gates from the plan

| Gate                                   | State                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Smoke run green in three browsers   | Passed, plus two mobile device profiles and real Chrome and Edge                                  |
| 2. Every matrix row has a passing spec | Passed for every row in `coverage-matrix.md`; what is deferred or impossible is listed there      |
| 3. Seeded breakages healed or refused  | Passed with rules (local pages, live dynamic-id page) and with a local model (`qwen2.5-coder:7b`) |

## CI fixes on 19 Nov

- **Chrome and Edge smoke jobs failed** on `main` and on every Dependabot pull request: the job
  installed only Chrome or Edge, but the setup and login projects that run first use Playwright's
  bundled Chromium. Both are installed now.
- **The Playwright 1.65.1 pull request also failed the visual job**, which runs in the `v1.65.0`
  image whose browsers belong to 1.65.0. Every job, the Dockerfile, and the Azure DevOps and Jenkins
  shards now install browsers for the installed Playwright version, and the quality job warns
  (`scripts/check-playwright-image.mjs`) when an image tag lags behind.
- **The data job's summary step failed** (`EACCES: mkdir .aiqa/history/runs`): the test container
  runs as root, so the history it wrote was root-owned, and the reader, failing to open it, tried to
  create a new store. Readers now open history read-only and never create anything; the run store
  no longer uses SQLite's WAL mode (WAL databases cannot be read without write access); the job hands
  the files back to the runner user; summary steps can no longer fail a job. Reproduced and checked
  as a non-root user in the Linux workspace.
- Not yet seen green on GitHub: these fixes run on the next push.

## Not run yet

- **Azure DevOps and Jenkins.** `azure-pipelines.yml` and the `Jenkinsfile` mirror the GitHub workflow
  but have not run on either server. The GitHub `data` job (the Docker stack) has not run on GitHub yet.
- **`aiqa new page --url` against a live site.** Checked here against a local copy of a login page only.

- **New CI jobs.** `branded` (Chrome, Edge), `lighthouse` and `visual` have not been seen green on
  GitHub from this workspace. `visual` compares against the Linux baseline inside the same Playwright
  Docker image that created it; if GitHub's runner renders differently, raise `maxDiffPixelRatio` or
  regenerate the baseline from the job's `visual-diff` artifact.
- **The Playwright test agents** are initialised (`.claude/agents`, `.mcp.json`, `tests/seed.spec.ts`,
  which passes). No plan or test has been generated with them yet.
- **Firefox and WebKit run journeys and smoke only**; the labs run on Chromium by design.

## Known gaps and honest notes

- **pnpm links fail intermittently on the laptop** ("EPERM: operation not permitted, symlink"), with
  pnpm 10 as well as 12, and with Defender real-time protection off. Likely cause, not proven: VS Code
  was running a Playwright test server and an ESLint bridge out of this `node_modules`, holding files
  open while pnpm relinked them. Retrying gets through: `scripts/install-windows.ps1` retries
  `pnpm install` and creates any link pnpm names (it needed 5 attempts for the Playwright 1.65.1
  update). Closing VS Code before an install is worth trying first.
- **kafkajs is unmaintained** (last release 2023). It works with Kafka 4.3 here; the maintained
  `@platformatic/kafka` needs Node 22.22+ or 24.6+. The client sits behind `KafkaBus` in
  `packages/data-framework/src/bus.ts`, so switching is one file.

- **The model is slow on this CPU**: about 40 seconds per call with `qwen2.5-coder:7b`. Raise
  `OLLAMA_TIMEOUT_MS` on slower machines. AI stays off by default and every AI task has a fallback.
- **Two moderate advisories remain** in `pnpm audit`: `minimatch` (through ESLint) and `glob` (through
  the Allure CLI). The fixed versions are a major ahead of what those tools accept, which is why
  Dependabot's two security updates failed. Both are build-time tools reading this repository's own
  files. They clear when ESLint and Allure release updates.
- **`_react=` and `_vue=` selectors do not work in Playwright 1.65** (the engines are gone), so that row
  of the plan cannot be built. Legacy layout selectors are covered instead.
- **SQLite stores on Node 23.3.** Node's built-in `node:sqlite` needs a flag on 23.3, so the heal store
  and the run store fall back to JSON files there, and their six SQLite contract tests skip. They pass on Node 22.13+ and 24.
- **Node version.** 23.3 is outside the supported range that Vitest 5 and ESLint 10 declare
  (22.12+/22.13+ or 24+). Both worked here, but Node 22 LTS or 24 LTS is the safe choice.
- **`pnpm` through corepack fails on this machine** (outdated corepack in Node 23.3). The project
  therefore carries pnpm as a dev dependency; use `npx pnpm ...`.
- **`tslib` sits in the root `package.json`** because pnpm on the Windows laptop did not link it for
  Lighthouse's `intl-messageformat`. Lighthouse runs as a child process for the same module-loading reason.
- **Lighthouse score floors are deliberately low.** Raise them with `LH_MIN_*` as the app improves.
- **Two specs use a local page instead of a live site:** `getByTitle` (no demo target has a stable
  `title`) and the right-click test (The Internet's context-menu box did not become actionable).
  The service-worker, lock and legacy-layout specs are local by design.
- **Run history is per machine.** Locally it lives in `.aiqa/history`; on CI each job keeps its own in
  the Actions cache (`api` and `ui`), so the CI dashboards show one suite each and start empty on a new
  branch until its first run (they fall back to `main`'s history).
- **Dependabot majors held back on purpose.** TypeScript 7 breaks typescript-eslint (it supports up to
  6.0), `@types/node` should match Node 22, and pnpm 12 fails with "Access is denied" creating links
  on the Windows laptop where pnpm 10 works. All three were pinned back after Dependabot merged them,
  and `.github/dependabot.yml` now skips those majors. pnpm 12 may work with Windows Developer Mode on;
  not tried. The old dependency folders from that attempt are in `_to_delete/` (git-ignored), to delete by hand.

## Differences from the Phase 1 plan

- Dropped from the catalog because the working core did not need them:
  `playwright-lighthouse` (replaced by calling `lighthouse` directly), `graphql-request` (Playwright's request context is used instead),
  the `ollama` client (plain `fetch`), `better-sqlite3` (Node's built-in driver), `pino-pretty`,
  `eslint-plugin-boundaries` (ESLint's built-in `no-restricted-imports` enforces the same rule),
  `license-checker` (`pnpm licenses list`).
- Added: `pnpm` as a dev dependency.
- All five AI tasks are built. Locator generation picks from the elements in the page's aria snapshot,
  so it cannot invent a selector.
- Added for Sprints 6 to 8: `@aiqa/reporting-engine`, `test-data-engine`, `cli`, `data-framework`, `apps/order-service`;
  `pg`, `mongodb`, `kafkajs`, OpenTelemetry metrics with the Prometheus exporter, `commander`, `tsx`.
  The plan's `testcontainers` was not used: the stack is Docker Compose, which CI runners and the
  laptop already have, and one stack serves every suite.
- Added later: `lighthouse`, `cross-env`, `tslib`, the `lighthouse` and branded browser projects,
  a `snapshots` Docker service, Dependabot config, and the `branded`, `lighthouse` and `visual` CI jobs.
