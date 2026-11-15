# Status

Last full run: 15 Nov 2026, Windows laptop (Dell Latitude 7420), Node 23.3.0, Playwright 1.65.0.
The working core (Sprints 1 to 5 of the plan) is built. Sprints 6 onward are not started.

## What was run, and the result

| Check                                          | Where                              | Result                                                                                 |
| ---------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| Type-check (`pnpm typecheck`)                  | Windows laptop and Linux workspace | Clean                                                                                  |
| Lint (`pnpm lint`)                             | Windows laptop and Linux workspace | 0 errors, 4 warnings                                                                   |
| Unit tests (`pnpm test:unit`)                  | Linux workspace, Node 22           | 76 passed                                                                              |
| Unit tests (`pnpm test:unit`)                  | Windows laptop, Node 23.3          | 73 passed, 3 skipped (SQLite, see below)                                               |
| API specs (`pnpm test:api`)                    | Windows laptop, live APIs          | 18 passed                                                                              |
| UI specs (`pnpm test:ui`)                      | Windows laptop, live sites         | 143 tests: 140 passed, 2 skipped on purpose, 1 failed once                             |
| Live model tests (`pnpm test:ai`)              | Windows laptop, `qwen2.5-coder:7b` | 4 passed: failure analysis, bug report, locator generation, test data                  |
| Generated-data API spec with `AI_ENABLED=true` | Windows laptop, live API           | Passed; the booking was written by the model, accepted and read back unchanged         |
| Smoke in Chrome and Edge                       | Windows laptop                     | 4 passed in each                                                                       |
| Lighthouse audit (`pnpm test:lighthouse`)      | Windows laptop                     | Passed against the score floors                                                        |
| Linux visual baseline (Docker `snapshots`)     | Windows laptop, Docker Desktop     | Created `login-form-chromium-linux.png`                                                |
| GitHub Actions                                 | GitHub                             | Green on the initial commit and on the pnpm update; later pushes not checked from here |

The one UI failure: the Firefox checkout journey timed out on the Finish click during the full
four-worker run. The same spec then passed three times in a row on its own, so it is recorded as a
load-related flake on this laptop, not fixed. CI retries failed tests twice; local runs do not retry.

The two skips are deliberate: the `test.fixme` demo, and the model tie-break spec, which skips unless
`AI_ENABLED=true`. That spec covers the fifth AI task and passed with the model on 13 Nov.

## Gates from the plan

| Gate                                   | State                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Smoke run green in three browsers   | Passed, plus two mobile device profiles and real Chrome and Edge                                  |
| 2. Every matrix row has a passing spec | Passed for every row in `coverage-matrix.md`; what is deferred or impossible is listed there      |
| 3. Seeded breakages healed or refused  | Passed with rules (local pages, live dynamic-id page) and with a local model (`qwen2.5-coder:7b`) |

## Not run yet

- **New CI jobs.** `branded` (Chrome, Edge), `lighthouse` and `visual` have not been seen green on
  GitHub from this workspace. `visual` compares against the Linux baseline inside the same Playwright
  Docker image that created it; if GitHub's runner renders differently, raise `maxDiffPixelRatio` or
  regenerate the baseline from the job's `visual-diff` artifact.
- **The Playwright test agents** are initialised (`.claude/agents`, `.mcp.json`, `tests/seed.spec.ts`,
  which passes). No plan or test has been generated with them yet.
- **Firefox and WebKit run journeys and smoke only**; the labs run on Chromium by design.

## Known gaps and honest notes

- **The model is slow on this CPU**: about 40 seconds per call with `qwen2.5-coder:7b`. Raise
  `OLLAMA_TIMEOUT_MS` on slower machines. AI stays off by default and every AI task has a fallback.
- **Two moderate advisories remain** in `pnpm audit`: `minimatch` (through ESLint) and `glob` (through
  the Allure CLI). The fixed versions are a major ahead of what those tools accept, which is why
  Dependabot's two security updates failed. Both are build-time tools reading this repository's own
  files. They clear when ESLint and Allure release updates.
- **`_react=` and `_vue=` selectors do not work in Playwright 1.65** (the engines are gone), so that row
  of the plan cannot be built. Legacy layout selectors are covered instead.
- **SQLite store on Node 23.3.** Node's built-in `node:sqlite` needs a flag on 23.3, so the heal store
  falls back to JSON files there and the three SQLite contract tests skip. They pass on Node 22.13+ and 24.
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
- **History tables.** `test_run` and `test_result` exist in the schema but nothing writes them yet;
  the custom reporter is Sprint 6 work.

## Differences from the Phase 1 plan

- Dropped from the catalog because the working core did not need them:
  `playwright-lighthouse` (replaced by calling `lighthouse` directly), `graphql-request` (Playwright's request context is used instead),
  the `ollama` client (plain `fetch`), `better-sqlite3` (Node's built-in driver), `pino-pretty`,
  `eslint-plugin-boundaries` (ESLint's built-in `no-restricted-imports` enforces the same rule),
  `license-checker` (`pnpm licenses list`).
- Added: `pnpm` as a dev dependency.
- All five AI tasks are built. Locator generation picks from the elements in the page's aria snapshot,
  so it cannot invent a selector.
- Added later: `lighthouse`, `cross-env`, `tslib`, the `lighthouse` and branded browser projects,
  a `snapshots` Docker service, Dependabot config, and the `branded`, `lighthouse` and `visual` CI jobs.
