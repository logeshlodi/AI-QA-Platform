# Framework design

**You will learn:** how the framework is put together, why it is put together that way, and how to add
to it without making it worse. The code is in `packages/playwright-framework/src/`; the reasons are in
[`docs/adr`](../adr) (start with 0002 and 0003).

## The pieces

| Folder                  | What it holds                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/fixtures/index.ts` | The dependency-injection container: fixture sets merged with `mergeTests` into the one `test` every spec imports |
| `src/pages/saucedemo/`  | Page objects: locators defined once, actions, no assertions about business outcomes                              |
| `src/components/`       | Parts several pages share: the header, a product card                                                            |
| `src/flows/`            | Facades over several pages: a spec says what it buys, `CheckoutFlow` knows how                                   |
| `src/checks/`           | Accessibility, console errors, security headers, Lighthouse                                                      |
| `src/healing/`          | The Playwright side of self-healing (guide 05)                                                                   |
| `src/perf/`             | Web Vitals, resource timing, throttling, memory, tracing (guide 07)                                              |
| `tests/setup/`          | `health.setup.ts` pings every demo target; `auth.setup.ts` saves a login                                         |

## Fixtures are the container

Read `src/fixtures/index.ts` from top to bottom; it is short. Things to notice:

- **Scope.** `env` and `targetStatus` are worker fixtures, made once per worker. Pages and flows are
  test fixtures, made fresh for every test. A shared page or browser between tests would break
  parallel runs, which is why no singleton holds one (ADR 0002).
- **Auto fixtures.** `targetGuard` runs for every test without being asked for: when a spec's demo site
  failed its health check, the test is skipped with a `target-down` annotation instead of failing. "The
  site was down" and "the test failed" are different results.
- **Options.** `test.use({ healMode: 'off' })` changes one spec's behaviour without touching the others.
- **Composition.** Fixtures depend on fixtures: `checkoutFlow` asks for three page objects, and
  Playwright builds them in order and tears them down after.

## Page objects, components and flows

`InventoryPage.card(name)` filters the product cards by name and returns a `ProductCard` that works only
inside that card: one locator scoped by content, not `nth(3)`. Locators carry `describe()`, so traces
read "Sort dropdown", not a selector. A page object exposes actions and locators; the spec makes the
assertions, so a page object never hides a failure.

## Configuration

`packages/shared/src/env.ts` parses every environment variable once with zod. A typo in a variable name
fails at start-up with a clear message, before a browser opens. `.env.example` lists them all.

## Boundaries that keep it maintainable

ESLint enforces two import rules (`eslint.config.mjs`): `shared` never imports Playwright, and the
engines never import the test runner. So the self-healing, AI, reporting and test-data engines are plain
TypeScript, unit-tested in milliseconds, and usable from the CLI. When you add code, put it in the
lowest layer that can hold it.

## Isolation

Every test must pass alone, in any order, in any worker. `pnpm test:shuffle` proves it for the whole
suite. A module-level variable shared by two tests is the classic way to break it (lab 05): each worker
loads the file separately, so the second test may never see what the first one set.

## Adding a page object, the quick way

```bash
npx pnpm aiqa new page Inventory --path /inventory.html --url
```

It opens the live page, builds `getByRole` locators for the unique named elements in its accessibility
tree, and writes a page object and a starter spec. Read what it wrote before keeping it.
