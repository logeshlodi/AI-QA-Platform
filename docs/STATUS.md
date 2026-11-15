# Status

Last full run: 13 Nov 2026, Windows laptop (Dell Latitude 7420), Node 23.3.0, Playwright 1.65.0.

## What was run, and the result

| Check                                | Where                              | Result                                               |
| ------------------------------------ | ---------------------------------- | ---------------------------------------------------- |
| Type-check (`pnpm typecheck`)        | Windows laptop and Linux workspace | Clean                                                |
| Lint (`pnpm lint`)                   | Windows laptop and Linux workspace | 0 errors, 4 warnings                                 |
| Unit tests (`pnpm test:unit`)        | Linux workspace, Node 22           | 63 passed                                            |
| Unit tests (`pnpm test:unit`)        | Windows laptop, Node 23.3          | 60 passed, 3 skipped (SQLite, see below)             |
| API specs (`pnpm test:api`)          | Windows laptop, live APIs          | 17 passed                                            |
| UI specs (`pnpm test:ui`)            | Windows laptop, live sites         | 126 passed, 1 skipped on purpose (`test.fixme` demo) |
| Allure report (`pnpm report:allure`) | Windows laptop                     | Generated                                            |

UI run by project: setup 1, auth 1, chromium 100, firefox 10, webkit 10, mobile-chrome 2, mobile-safari 2.

## Gates from the plan

| Gate                                   | State                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Smoke run green in three browsers   | Passed, plus two mobile device profiles                                                           |
| 2. Every matrix row has a passing spec | Passed for the rows in `coverage-matrix.md`; the rows listed under "not built yet" there are open |
| 3. Seeded breakages healed or refused  | Passed with rules (local pages and the live dynamic-id page). Not yet shown with a local model    |

## Known gaps and honest notes

- **No model was pulled**, so the Ollama path has only been exercised through unit tests with a fake
  provider and a mocked HTTP layer. `ollama pull qwen2.5-coder:7b` plus `AI_ENABLED=true` turns it on.
- **SQLite store on Node 23.3.** Node's built-in `node:sqlite` needs a flag on 23.3, so the heal store
  falls back to JSON files there and the three SQLite contract tests skip. They pass on Node 22.13+ and 24.
- **Node version.** 23.3 is outside the supported range that Vitest 5 and ESLint 10 declare
  (22.12+/22.13+ or 24+). Both worked here, but Node 22 LTS or 24 LTS is the safe choice.
- **`pnpm` through corepack fails on this machine** (outdated corepack in Node 23.3). The project
  therefore carries pnpm as a dev dependency; use `npx pnpm ...`.
- **Not run:** the GitHub Actions workflow (nothing has been pushed), the Dockerfile and
  docker-compose file, and the Chrome and Edge branded projects.
- **Visual baselines exist for Chromium on Windows only.** CI ignores snapshots until Linux baselines
  are generated inside the Docker image.
- **Two specs use a local page instead of a live site:** `getByTitle` (no demo target has a stable
  `title`) and the right-click test (The Internet's context-menu box did not become actionable).
- **History tables.** `test_run` and `test_result` exist in the schema but nothing writes them yet;
  the custom reporter is Sprint 6 work.

## Differences from the Phase 1 plan

- Dropped from the catalog because the working core did not need them: `lighthouse`,
  `playwright-lighthouse`, `graphql-request` (Playwright's request context is used instead),
  the `ollama` client (plain `fetch`), `better-sqlite3` (Node's built-in driver), `pino-pretty`,
  `eslint-plugin-boundaries` (ESLint's built-in `no-restricted-imports` enforces the same rule),
  `license-checker` (`pnpm licenses list`).
- Added: `pnpm` as a dev dependency.
- AI tasks built: locator tie-breaking, failure analysis, bug-report draft. Locator generation from
  an aria snapshot and schema-driven test data are not built; the booking builder covers test data
  for the API specs.
