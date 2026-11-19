# Coverage matrix

Paths are relative to `packages/playwright-framework/tests/` unless they start with `api-framework`.

## Locators

| Locator                                                        | Spec                                  | Target                |
| -------------------------------------------------------------- | ------------------------------------- | --------------------- |
| `getByRole` (name, level, checked, regex)                      | `locators/role.spec.ts`               | The Internet          |
| `getByText` (whitespace, exact, regex, nbsp)                   | `locators/text.spec.ts`               | UI Testing Playground |
| `getByLabel`                                                   | `locators/label.spec.ts`              | The Internet          |
| `getByPlaceholder`                                             | `locators/placeholder.spec.ts`        | SauceDemo             |
| `getByAltText`                                                 | `locators/alt-text.spec.ts`           | SauceDemo             |
| `getByTitle`                                                   | `locators/title.spec.ts`              | Local page            |
| `getByTestId` + `testIdAttribute` override                     | `locators/test-id.spec.ts`            | SauceDemo, TodoMVC    |
| CSS                                                            | `locators/css.spec.ts`                | SauceDemo             |
| XPath                                                          | `locators/xpath.spec.ts`              | The Internet          |
| `filter` (hasText, hasNotText, has, hasNot)                    | `locators/filter.spec.ts`             | SauceDemo             |
| `filter({ visible })`, `visible()`                             | `locators/visible.spec.ts`            | UI Testing Playground |
| Chaining, `within()`                                           | `locators/chaining-within.spec.ts`    | The Internet          |
| `and()`, `or()`                                                | `locators/and-or.spec.ts`             | The Internet          |
| `first`, `last`, `nth`, `count`, `all`                         | `locators/nth.spec.ts`                | The Internet          |
| `frameLocator`, `contentFrame`, selector-less `frameLocator()` | `locators/frames.spec.ts`             | The Internet          |
| Shadow DOM piercing                                            | `locators/shadow-dom.spec.ts`         | UI Testing Playground |
| `describe()`, `description()`                                  | `locators/describe.spec.ts`           | SauceDemo             |
| `toMatchAriaSnapshot`                                          | `locators/aria-snapshot.spec.ts`      | TodoMVC               |
| `selectors.register`                                           | `locators/custom-engine.spec.ts`      | SauceDemo             |
| `addLocatorHandler`                                            | `locators/locator-handler.spec.ts`    | The Internet          |
| Dynamic ids and classes                                        | `locators/dynamic-attributes.spec.ts` | UI Testing Playground |

## Features

| Feature group                                                                   | Spec                                                                    | Target                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| Lighthouse audit (performance, accessibility, best practices, SEO)              | `audits/lighthouse.spec.ts`, `src/checks/lighthouse.ts`                 | SauceDemo                         |
| Projects, devices, branded channels                                             | `playwright.config.ts`, `smoke/saucedemo.smoke.spec.ts`                 | SauceDemo                         |
| Setup project, health check, saved login                                        | `setup/*.setup.ts`                                                      | All targets                       |
| Fixtures (test, worker, option, auto, mergeTests)                               | `src/fixtures/index.ts`, `features/execution.spec.ts`                   | none                              |
| Tags, annotations, steps, skip, fixme, serial                                   | `features/execution.spec.ts`                                            | none                              |
| `storageState`, cookie injection                                                | `features/auth-storage-state.spec.ts`                                   | SauceDemo                         |
| HTTP basic auth                                                                 | `features/basic-auth.spec.ts`                                           | The Internet                      |
| `route`: observe, fulfil, modify, abort                                         | `features/network-mocking.spec.ts`                                      | Playwright API-mocking demo       |
| HAR record, edit, replay                                                        | `features/har.spec.ts`                                                  | Playwright API-mocking demo       |
| Web-first, soft, `expect.poll`, `toPass`, custom matcher                        | `features/assertions.spec.ts`                                           | UI Testing Playground             |
| Auto-waiting and actionability                                                  | `features/auto-wait.spec.ts`                                            | UI Testing Playground             |
| Upload, download, drag and drop                                                 | `features/files-and-drag.spec.ts`                                       | The Internet                      |
| Dialogs, right-click, new tabs                                                  | `features/dialogs-and-tabs.spec.ts`                                     | The Internet, local page          |
| Hover, keyboard, select                                                         | `features/mouse-and-keyboard.spec.ts`                                   | The Internet                      |
| Geolocation, permissions, locale, timezone, dark mode, offline, clock           | `features/emulation.spec.ts`                                            | The Internet, none                |
| Cookies, local storage                                                          | `features/browser-state.spec.ts`                                        | SauceDemo, TodoMVC                |
| Console and page errors, broken images, link status, security headers, SEO tags | `features/quality-checks.spec.ts`                                       | The Internet, SauceDemo           |
| Accessibility (axe-core)                                                        | `features/accessibility.spec.ts`                                        | SauceDemo                         |
| Responsive viewports, navigation timing                                         | `features/responsive-and-performance.spec.ts`                           | SauceDemo                         |
| WebSocket mocking                                                               | `features/websocket.spec.ts`                                            | none                              |
| Service workers (visible on the context, offline from cache, routing, blocking) | `features/service-workers.spec.ts`                                      | Local site started by the spec    |
| Test locks (`lock`) and `--shuffle`                                             | `features/locks-and-shuffle.spec.ts`, `pnpm test:shuffle`               | None needed                       |
| Legacy layout selectors (`:right-of`, `:below`, `:near`)                        | `locators/legacy-layout.spec.ts`                                        | Local page                        |
| AI: locator generation from an aria snapshot                                    | `ai/locator-generation.spec.ts`                                         | SauceDemo                         |
| AI: schema-driven test data                                                     | `api-framework/tests/restful-booker/generated-data.spec.ts`             | Restful-Booker                    |
| Playwright test agents (planner, generator, healer)                             | `.claude/agents/`, `tests/seed.spec.ts`, `specs/`                       | SauceDemo                         |
| Core Web Vitals (LCP, CLS, INP, FCP, TTFB) with Google's `web-vitals`           | `performance/web-vitals.spec.ts`, `src/perf/vitals.ts`                  | SauceDemo, TodoMVC                |
| Performance budget: requests and bytes from Resource Timing                     | `performance/page-weight.spec.ts`, `src/perf/resources.ts`              | SauceDemo                         |
| Network and CPU throttling (DevTools Protocol)                                  | `performance/throttled.spec.ts`, `src/perf/throttling.ts`               | SauceDemo                         |
| Memory-leak check (garbage-collected JS heap)                                   | `performance/memory.spec.ts`, `src/perf/memory.ts`                      | TodoMVC                           |
| Chrome performance trace (`browser.startTracing`)                               | `src/perf/tracing.ts` (`PERF_TRACE=1`)                                  | SauceDemo                         |
| Performance trends and regressions in the run history                           | `reporting-engine` `metricTrends`, `aiqa perf`, dashboard               | Recorded runs                     |
| Load testing (k6: smoke, load, stress), end-to-end order latency                | `load-tests/scripts/order-flow.js`, `pnpm perf:load`                    | Order service (Docker)            |
| Visual comparison                                                               | `visual/login.visual.spec.ts`                                           | SauceDemo                         |
| Data-driven tests                                                               | `journeys/login.spec.ts`, `api-framework/tests/soap/calculator.spec.ts` | SauceDemo, SOAP                   |
| Self-healing                                                                    | `healing/healer-local.spec.ts`, `healing/dynamic-id.spec.ts`            | Local page, UI Testing Playground |
| REST chaining, auth, schema validation                                          | `api-framework/tests/restful-booker/*.spec.ts`                          | Restful-Booker                    |
| GraphQL                                                                         | `api-framework/tests/graphql/countries.spec.ts`                         | Countries API                     |
| SOAP                                                                            | `api-framework/tests/soap/calculator.spec.ts`                           | DNE Online calculator             |

## In the plan, not built yet

Component testing (deferred to the new stories model), OAuth and JWT (needs a local identity
provider), Pact (needs a provider we control), OpenAPI validation (no demo target publishes a file).

Not possible in this Playwright version: the `_react=` and `_vue=` framework selectors. Playwright
1.65 still parses the names but no longer ships the engines; a probe against a local React 18 and
Vue 3 page failed inside Playwright itself. The legacy layout selectors still work and are covered.
