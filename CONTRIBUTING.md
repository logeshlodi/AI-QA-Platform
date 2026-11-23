# Contributing

How to work in this repository: set-up, the checks a change must pass, and the coding standards the
specs follow. The [architecture](docs/architecture.md) explains how the parts fit; the
[decision records](docs/adr/README.md) explain why.

## Set-up

```bash
nvm use                      # Node 24 LTS, from .nvmrc
npx pnpm install             # pnpm 10
npx pnpm exec playwright install chromium firefox webkit
cp .env.example .env         # nothing in it is required; AI stays off until you switch it on
npx pnpm test:unit           # about 15 seconds, no browser, no network
```

Open the folder in VS Code and accept the recommended extensions (`.vscode/extensions.json`): Playwright
Test, ESLint, Prettier, Vitest. Formatting and lint fixes then happen on save, the same way the
pre-commit hook and CI apply them. If something does not install or start, see
[troubleshooting](docs/troubleshooting.md).

## Making a change

1. Branch from `main`: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
2. Write the test first when you change behaviour; a bug fix starts with a test that fails.
3. Run what CI runs, before you push:

   ```bash
   npx pnpm typecheck
   npx pnpm lint                 # 0 errors and 0 warnings: a warning is treated as a failure to fix
   npx pnpm test:unit
   npx pnpm exec prettier --check .
   ```

   plus the suite you touched (`test:ui`, `test:api`, `test:data` with `stack:up`, `test:web`).

4. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat: ...`, `fix: ...`), checked by commitlint in the `commit-msg` hook. The `pre-commit` hook runs
   ESLint and Prettier on staged files only.
5. A change in direction (a new tool, a new layer, dropping a practice) gets an ADR in `docs/adr/`,
   numbered next, with the options that were rejected and why.
6. Update `docs/STATUS.md` with what ran, where and the result. Claims without a run do not go in.

Versions live in one place, the catalog in `pnpm-workspace.yaml`; packages refer to `catalog:`. Every
new dependency must pass the licence gate (`pnpm security:licences`): open-source licences only.

## Coding standards for specs

These are what review checks, and most are enforced by ESLint (`eslint.config.mjs`).

**Locators**, in this order: `getByRole` with a name, `getByLabel`, `getByPlaceholder`, `getByText`,
`getByTestId`; CSS only when nothing user-facing identifies the element; XPath never in a suite (it is
in `tests/locators/xpath.spec.ts` to show why). Locators are defined once, in a page object or
component, and given a `.describe()` so reports and traces name them.

**Waiting.** Web-first assertions (`await expect(locator).toHaveText(...)`) and actions wait by
themselves. No `waitForTimeout`, no sleeps, no `isVisible()` checks in `if`. Wait for a condition you
can name: a response (`waitForResponse`), a URL, a state of the page, or `expect.poll` for something
outside it.

**Assertions.** Every test asserts (lint fails one that does not). Assert what a user would see, in
the test, not in page objects (except "the page has loaded"). One behaviour per test; `test.step` for
the parts of a longer journey. No assertions inside `if`: split the cases instead.

**Structure.** Specs import `test` and `expect` from `src/fixtures`, never from `@playwright/test`,
so they get the page objects, healing and checks. Page objects hold locators and actions; flows hold
journeys over several pages; components hold repeated parts of a page. Shared set-up is a fixture,
not `beforeEach`: it is created only when asked for and cleaned up even when the test fails.

**Independence.** Any test runs alone, in any order, in parallel (`pnpm test:shuffle` checks).
Data is created per test with a seed (`AIQA_SEED` replays a failure); nothing depends on a record
another test made. A resource that cannot take two writers gets a test lock, not `serial` mode.

**Targets.** Specs name the demo site they need (`test.use({ targetName })`); a site that is down
skips its specs instead of failing them. Load and security scans are aimed only at our own order
service and web app, never at a public demo site.

**Titles** say what the user gets, in plain words: "a locked-out user is refused with a reason", not
"test login 3".

**TypeScript.** Strict mode; no `any` without a comment saying why; zod at every boundary where data
comes from outside (environment, files, HTTP, model output).

## Adding things

- **A spec**: next to the ones like it (`tests/features`, `tests/journeys`, `tests/locators`). If it
  shows a Playwright feature, add a row to the [coverage matrix](docs/coverage-matrix.md).
- **A page object**: `src/pages/<site>/`, extending `BasePage`; register it as a fixture.
- **A package**: `packages/<name>` with its own README, added to the Dockerfiles that list every
  manifest (`infrastructure/docker/Dockerfile`, `apps/*/Dockerfile`) and to the README's package table.
- **An interview question**: `packages/interview-learning/src/bank.ts`; its unit test checks every
  file it points at exists.
- **A lab**: `packages/examples/labs/NN-name/` with `exercise.spec.ts` (broken) and `solution.spec.ts`.
