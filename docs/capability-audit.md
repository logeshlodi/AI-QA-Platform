# Playwright capability audit

An enterprise Playwright checklist (29 areas), scored against this repository on 23 Nov 2026. Each item
points at the file that proves it. ✅ built and run, 🟡 partly there, ❌ missing. Paths starting with
`fw/` are under `packages/playwright-framework/`.

## Summary

| Status | Items |
| ------ | ----- |
| ✅     | 270   |
| 🟡     | 9     |
| ❌     | 4     |

Maturity: **level 5** (AI-assisted testing, an MCP server, Playwright's test agents compared with
nine of our own, self-healing with review, run analytics). The first audit found 29 missing and 24
partial items; the sprint that followed closed 40 of them (browser APIs, tablet and touch, files,
request modification, screenshots, debugging, IndexedDB state, CSV and YAML data, CSRF and XSS checks,
editor settings and the contributor docs). What is left is listed, with the reason, at
[the end](#what-is-left).

## 1. Project architecture

| Item                  | Status | Where                                                                  |
| --------------------- | ------ | ---------------------------------------------------------------------- |
| Page Object Model     | ✅     | `fw/src/pages/` (base page, SauceDemo pages)                           |
| Page components       | ✅     | `fw/src/components/` (header, product card)                            |
| Business layer        | ✅     | `fw/src/flows/` (login flow, checkout flow)                            |
| Fixtures              | ✅     | `fw/src/fixtures/index.ts` (merged with `mergeTests`), ADR 0002        |
| Utilities             | ✅     | `packages/shared`                                                      |
| Constants             | ✅     | `packages/shared/src/targets.ts` (target sites in one place)           |
| Test data             | ✅     | `packages/test-data-engine` (seeded builders)                          |
| Environment config    | ✅     | `packages/shared/src/env.ts` (one zod schema), `.env.example`          |
| Common helpers        | ✅     | `fw/src/checks/`, `fw/src/perf/`                                       |
| Hooks                 | ✅     | fixtures with automatic teardown; `beforeEach` only in labs, by design |
| API layer             | ✅     | `packages/api-framework`                                               |
| Database layer        | ✅     | `packages/data-framework` (Postgres, MongoDB fixtures)                 |
| Reporting layer       | ✅     | `packages/reporting-engine`                                            |
| Logger                | ✅     | `packages/shared/src/logger.ts` (pino, structured)                     |
| Authentication module | ✅     | `fw/tests/setup/auth.setup.ts`, `packages/data-framework/src/auth.ts`  |
| AI module             | ✅     | `packages/ai-engine`, `packages/ai-agents`                             |
| CLI                   | ✅     | `packages/cli` (`aiqa`)                                                |
| Shared components     | ✅     | `packages/shared`, `packages/dashboard` (React)                        |

## 2. Playwright test runner

| Item                   | Status | Where                                                                             |
| ---------------------- | ------ | --------------------------------------------------------------------------------- |
| `playwright.config.ts` | ✅     | one per package, `fw/playwright.config.ts` the main one                           |
| Multiple projects      | ✅     | setup, auth, chromium, firefox, webkit, mobile, branded, lighthouse, perf         |
| Multiple browsers      | ✅     | Chromium, Firefox, WebKit, Chrome, Edge                                           |
| Multiple environments  | ✅     | `TARGET_<SITE>_URL` per target (`packages/shared/src/targets.ts`)                 |
| Global setup           | ✅     | setup projects in `fw`; `globalSetup` in `apps/web`                               |
| Global teardown        | ✅     | `fw/tests/setup/cleanup.teardown.ts`, the `teardown` project of `setup`           |
| Worker fixtures        | ✅     | `fw/src/fixtures/index.ts`, `data-framework/src/fixtures.ts`                      |
| Test fixtures          | ✅     | page objects, flows, healing, checks                                              |
| Test annotations       | ✅     | `fw/tests/features/execution.spec.ts` (tags, a `requirement` annotation, `fixme`) |
| Tags                   | ✅     | `@smoke`, `@lab`, `@kafka`, `@rabbitmq`, `@grpc` ...                              |
| Metadata               | ✅     | `metadata` in `fw/playwright.config.ts`                                           |
| Retries                | ✅     | 2 on CI, 0 locally                                                                |
| Retry strategy         | ✅     | trace on first retry; flaky detected from retries in the run history              |
| Timeouts               | ✅     | test, expect and action timeouts in each config                                   |
| Fully parallel         | ✅     | `fullyParallel: true`                                                             |
| Sharding               | ✅     | CI UI job in 3 shards, merged report                                              |
| Workers configuration  | ✅     | 4 on CI, `--workers=1` for perf                                                   |
| Grep                   | ✅     | `test:smoke` (`--grep @smoke`)                                                    |
| Grep invert            | ✅     | CI shards (`--grep-invert @audit`)                                                |
| Test filtering         | ✅     | `testMatch`, `testIgnore` per project                                             |
| Test locking           | ✅     | `fw/tests/features/locks-and-shuffle.spec.ts`                                     |
| Exclusive locks        | ✅     | the same spec (`-exclusive-`)                                                     |
| Projects               | ✅     | see above                                                                         |
| Test dependencies      | ✅     | `dependencies: ['setup', 'auth']`                                                 |

## 3. Parallel execution

| Item                  | Status | Where                                                  |
| --------------------- | ------ | ------------------------------------------------------ |
| Parallel execution    | ✅     | every config                                           |
| Fully parallel        | ✅     | `fullyParallel`                                        |
| Worker isolation      | ✅     | a fresh browser context per test; unique data per test |
| Parallel browsers     | ✅     | three engine projects; `k8s:test ui all-browsers`      |
| Parallel environments | 🟡     | one target set per run; no matrix over environments    |
| Parallel devices      | ✅     | mobile-chrome and mobile-safari projects               |
| Parallel CI execution | ✅     | parallel CI jobs                                       |
| Sharding support      | ✅     | `--shard=n/3`                                          |

## 4. Browser support

| Item               | Status | Where                                                  |
| ------------------ | ------ | ------------------------------------------------------ |
| Chromium           | ✅     | `chromium` project                                     |
| Chrome             | ✅     | `test:chrome` (`channel: 'chrome'`), CI job            |
| Edge               | ✅     | `test:edge`, CI job                                    |
| Firefox            | ✅     | `firefox` project                                      |
| WebKit             | ✅     | `webkit` project                                       |
| Mobile Chrome      | ✅     | Pixel 7                                                |
| Mobile Safari      | ✅     | iPhone 14                                              |
| Tablet             | ✅     | `tablet` project (iPad Pro 11), smoke specs            |
| Responsive testing | ✅     | `fw/tests/features/responsive-and-performance.spec.ts` |

## 5. Trace and debugging

| Item             | Status | Where                                                                           |
| ---------------- | ------ | ------------------------------------------------------------------------------- |
| Trace Viewer     | ✅     | traces in every HTML report                                                     |
| Trace on failure | ✅     | `retain-on-failure` in the templates                                            |
| Trace on retries | ✅     | `on-first-retry` in `fw`                                                        |
| Live trace       | ✅     | UI mode (`test:ui-mode`); taught in the cheat sheet and troubleshooting page    |
| Trace chunks     | ✅     | `fw/tests/features/debugging.spec.ts` (`startChunk` / `stopChunk`, two zips)    |
| Trace uploads    | ✅     | reports with traces kept as CI artifacts                                        |
| HAR recording    | ✅     | `fw/tests/features/har.spec.ts`                                                 |
| HAR replay       | ✅     | the same spec (`routeFromHAR`)                                                  |
| Screenshots      | ✅     | `only-on-failure`                                                               |
| Video recording  | ✅     | `retain-on-failure`                                                             |
| Console logs     | ✅     | `fw/src/checks/console.ts` (fails on console errors)                            |
| Network logs     | ✅     | `fw/src/checks/network-log.ts`; the `networkLog` fixture attaches it on failure |
| Request logs     | ✅     | the same: method, URL, resource type per request                                |
| Response logs    | ✅     | the same: status, duration, failure, slow flag                                  |
| DOM snapshots    | ✅     | in traces                                                                       |
| ARIA snapshots   | ✅     | `fw/tests/locators/aria-snapshot.spec.ts`                                       |
| Screen snapshots | ✅     | screenshots and visual baselines                                                |
| Debug mode       | ✅     | `pnpm test:debug` (`--debug`)                                                   |
| Inspector        | ✅     | `pnpm test:debug`; in the cheat sheet and troubleshooting page                  |
| `page.pause()`   | ✅     | `fw/tests/features/debugging.spec.ts`, behind `PWDEBUG`                         |

## 6. Locator strategy

| Item               | Status | Where                                                   |
| ------------------ | ------ | ------------------------------------------------------- |
| `getByRole`        | ✅     | `fw/tests/locators/role.spec.ts`, everywhere            |
| `getByLabel`       | ✅     | `fw/tests/locators/label.spec.ts`                       |
| `getByPlaceholder` | ✅     | `fw/tests/locators/placeholder.spec.ts`, labs           |
| `getByText`        | ✅     | `fw/tests/locators/text.spec.ts`                        |
| `getByAltText`     | ✅     | `fw/tests/locators/alt-text.spec.ts`                    |
| `getByTitle`       | ✅     | `fw/tests/locators/title.spec.ts`                       |
| `getByTestId`      | ✅     | `fw/tests/locators/test-id.spec.ts`                     |
| CSS locators       | ✅     | `fw/tests/locators/css.spec.ts`                         |
| XPath              | ✅     | `fw/tests/locators/xpath.spec.ts` (and why to avoid it) |
| Locator chaining   | ✅     | `fw/tests/locators/chaining-within.spec.ts`             |
| Within / `filter`  | ✅     | the same, `filter({ has })`                             |
| `visible()`        | ✅     | `fw/tests/locators/visible.spec.ts`                     |
| `nth()`            | ✅     | `fw/tests/locators/nth.spec.ts`                         |
| `first()`          | ✅     | the same                                                |
| `last()`           | ✅     | the same                                                |
| Frame locators     | ✅     | `fw/tests/locators/frames.spec.ts`                      |
| Shadow DOM         | ✅     | `fw/tests/locators/shadow-dom.spec.ts`                  |

## 7. Authentication

| Item            | Status | Where                                                                             |
| --------------- | ------ | --------------------------------------------------------------------------------- |
| Storage state   | ✅     | `fw/tests/setup/auth.setup.ts`, `fw/tests/features/auth-storage-state.spec.ts`    |
| Login once      | ✅     | the auth setup project                                                            |
| Multiple users  | ✅     | `apps/web/tests/e2e/users.ts` (viewer, admin, no role), SauceDemo users           |
| OAuth           | ✅     | Keycloak client credentials, `data-framework/tests/http/auth.spec.ts`             |
| JWT             | ✅     | expired, tampered, `alg: none`, wrong audience; lab 08                            |
| SSO             | ✅     | OIDC sign-in through Keycloak, `apps/web/tests/e2e/auth.spec.ts`                  |
| Session reuse   | ✅     | storage state per user                                                            |
| Cookie handling | ✅     | `fw/tests/features/browser-state.spec.ts`, cookie tampering in web auth           |
| Local storage   | ✅     | `fw/tests/features/browser-state.spec.ts`                                         |
| IndexedDB       | ✅     | `fw/tests/features/indexeddb-state.spec.ts` (`storageState({ indexedDB: true })`) |

## 8. Network features

| Item                  | Status | Where                                                                                    |
| --------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Route interception    | ✅     | `fw/tests/features/network-mocking.spec.ts`                                              |
| Route mocking         | ✅     | the same                                                                                 |
| Route fulfillment     | ✅     | the same, lab 06                                                                         |
| Route abort           | ✅     | the same                                                                                 |
| Request modification  | ✅     | `fw/tests/features/request-modification.spec.ts` (headers, method, postData, `fallback`) |
| Response modification | ✅     | `route.fetch()` then `fulfill` with a changed body                                       |
| HAR replay            | ✅     | `fw/tests/features/har.spec.ts`                                                          |
| WebSocket routing     | ✅     | `fw/tests/features/websocket.spec.ts` (`routeWebSocket`)                                 |
| API mocking           | ✅     | mocked endpoints in the network spec                                                     |

## 9. API testing

| Item              | Status | Where                                                          |
| ----------------- | ------ | -------------------------------------------------------------- |
| REST              | ✅     | `api-framework/tests/restful-booker`, the order service        |
| GraphQL           | ✅     | `api-framework/tests/graphql/countries.spec.ts`                |
| SOAP              | ✅     | `api-framework/tests/soap/calculator.spec.ts`                  |
| Request context   | ✅     | `APIRequestContext` fixtures                                   |
| Schema validation | ✅     | zod schemas; every response against the OpenAPI document (Ajv) |
| Authentication    | ✅     | Restful-Booker tokens, Keycloak bearer tokens                  |
| Contract testing  | ✅     | `packages/contract-tests` (Pact, HTTP and messages)            |
| API chaining      | ✅     | Restful-Booker create, read, update, delete; lab 07            |

Beyond the list: gRPC (`data-framework/tests/grpc`) and messaging (Kafka, RabbitMQ).

## 10. Accessibility

| Item                     | Status | Where                                                                  |
| ------------------------ | ------ | ---------------------------------------------------------------------- |
| ARIA snapshots           | ✅     | `fw/tests/locators/aria-snapshot.spec.ts`                              |
| `getByRole` usage        | ✅     | the default locator throughout                                         |
| Accessible names         | ✅     | role locators by name; self-healing scores names                       |
| Keyboard navigation      | ✅     | `fw/tests/features/mouse-and-keyboard.spec.ts`, web dashboard keyboard |
| Screen reader validation | 🟡     | the accessibility tree is checked; no real screen reader is driven     |
| axe-core integration     | ✅     | `fw/src/checks/a11y.ts`, web app and every component state             |
| WCAG validation          | ✅     | WCAG 2.2 AA tags in axe                                                |

## 11. Visual testing

| Item                  | Status | Where                                                                      |
| --------------------- | ------ | -------------------------------------------------------------------------- |
| Screenshot testing    | ✅     | `fw/tests/visual/login.visual.spec.ts`                                     |
| Snapshot testing      | ✅     | ARIA snapshots, `toMatchSnapshot` in triage cases                          |
| Visual regression     | ✅     | Linux baselines in CI, component visual spec                               |
| Element screenshots   | ✅     | the login form only                                                        |
| Full-page screenshots | ✅     | `fw/tests/features/screenshot-options.spec.ts` (`fullPage: true`)          |
| Masking               | ✅     | the same (`mask`, `maskColor`)                                             |
| Style overrides       | ✅     | `style` in the same spec; `stylePath` for `toHaveScreenshot` in the config |
| Diff thresholds       | ✅     | `maxDiffPixelRatio: 0.01`                                                  |

## 12. Component testing

| Item                          | Status | Where                                                    |
| ----------------------------- | ------ | -------------------------------------------------------- |
| React                         | ✅     | `packages/dashboard/tests/components` (ADR 0015)         |
| Vue                           | ❌     | no Vue components to test                                |
| Angular                       | ❌     | no Angular components; Playwright has no Angular adapter |
| Story-based component testing | ✅     | the stories model, `packages/dashboard/src/stories`      |

## 13. Performance

| Item                   | Status | Where                                                                   |
| ---------------------- | ------ | ----------------------------------------------------------------------- |
| Lighthouse             | ✅     | `fw/tests/audits/lighthouse.spec.ts`                                    |
| Resource timing        | ✅     | `fw/src/perf/resources.ts`, page-weight spec                            |
| API timing             | ✅     | k6 per endpoint; API response-time checks                               |
| Network timing         | ✅     | Navigation and Resource Timing; throttling via CDP                      |
| Slow request detection | ✅     | `networkLog` flags requests over `slowRequestMs` and annotates the test |
| Console performance    | ✅     | Chrome performance traces (`PERF_TRACE=1`), web vitals                  |

Beyond the list: k6 load tests, memory-leak checks, trends and regression verdicts in the run history.

## 14. Devices

| Item            | Status | Where                                                                    |
| --------------- | ------ | ------------------------------------------------------------------------ |
| Desktop         | ✅     | Desktop Chrome, Firefox, Safari                                          |
| Tablet          | ✅     | `tablet` project (iPad Pro 11); Galaxy Tab S9 in `touch.spec.ts`         |
| Mobile          | ✅     | Pixel 7, iPhone 14                                                       |
| Custom viewport | ✅     | `test.use({ viewport })`                                                 |
| Touch           | ✅     | `fw/tests/features/touch.spec.ts` (`hasTouch`, `tap()`, CDP touch swipe) |
| Geolocation     | ✅     | `fw/tests/features/emulation.spec.ts`                                    |
| Timezone        | ✅     | the same                                                                 |
| Locale          | ✅     | the same                                                                 |
| Color scheme    | ✅     | the same; dark mode in components                                        |
| Permissions     | ✅     | the same (`geolocation`)                                                 |
| Offline mode    | ✅     | the same; service workers spec                                           |

## 15. File operations

| Item                  | Status | Where                                                                        |
| --------------------- | ------ | ---------------------------------------------------------------------------- |
| Upload                | ✅     | `fw/tests/features/files-and-drag.spec.ts`                                   |
| Multiple upload       | ✅     | `fw/tests/features/files-local.spec.ts` (several files, `filechooser` event) |
| Download              | ✅     | the same spec                                                                |
| Download verification | ✅     | the same: the CSV download's name, rows and total are checked                |
| Drag and drop         | ✅     | the same spec                                                                |
| Clipboard             | ✅     | `fw/tests/features/browser-apis.spec.ts` (granted and refused)               |

## 16. Advanced browser APIs

| Item                | Status | Where                                                                |
| ------------------- | ------ | -------------------------------------------------------------------- |
| Service workers     | ✅     | `fw/tests/features/service-workers.spec.ts`                          |
| WebSockets          | ✅     | `fw/tests/features/websocket.spec.ts`                                |
| WebAuthn / passkeys | ✅     | `fw/tests/features/browser-apis.spec.ts` (CDP virtual authenticator) |
| Notifications       | ✅     | `fw/tests/features/notifications.spec.ts` (granted and not granted)  |
| Permissions         | ✅     | geolocation granted and denied                                       |
| Clipboard           | ✅     | as above                                                             |
| Camera              | ✅     | `fw/tests/features/media-devices.spec.ts` (fake device stream)       |
| Microphone          | ✅     | the same                                                             |
| PDF                 | ✅     | `page.pdf()` for the PDF report, `fw/tests/reporting`                |
| Print               | ✅     | `emulateMedia({ media: 'print' })` in the PDF spec                   |

## 17. Reporting

| Item              | Status | Where                                                      |
| ----------------- | ------ | ---------------------------------------------------------- |
| HTML              | ✅     | every config                                               |
| Allure            | ✅     | `allure-playwright`, `pnpm report:allure`                  |
| JSON              | ✅     | `test-results/results.json`                                |
| JUnit XML         | ✅     | `test-results/junit.xml` (Azure DevOps, Jenkins read it)   |
| Blob              | ✅     | on CI, for merging shards                                  |
| GitHub reporter   | ✅     | on CI (annotations)                                        |
| Failures reporter | 🟡     | `list` and the custom reporter's failures; no `dot`/`line` |
| Custom reporter   | ✅     | `reporting-engine/src/playwright-reporter.ts`              |
| Merged reports    | ✅     | `fw/merge.config.ts`, CI                                   |
| Execution history | ✅     | SQLite or JSON run history, `aiqa history`                 |
| Trend reports     | ✅     | HTML dashboard, PDF report, Grafana "Test runs"            |

## 18. Assertions

| Item                  | Status | Where                                              |
| --------------------- | ------ | -------------------------------------------------- |
| Web-first assertions  | ✅     | everywhere; lint enforces them                     |
| `expect.poll()`       | ✅     | data suites                                        |
| Soft assertions       | ✅     | `fw/tests/features/assertions.spec.ts`, Lighthouse |
| Custom assertions     | ✅     | `expect.extend` in the assertions spec             |
| Screenshot assertions | ✅     | `toHaveScreenshot`                                 |
| ARIA assertions       | ✅     | `toMatchAriaSnapshot`                              |

Also `toPass()` for retried blocks.

## 19. Data management

| Item              | Status | Where                                                                                         |
| ----------------- | ------ | --------------------------------------------------------------------------------------------- |
| Test data factory | ✅     | `packages/test-data-engine`                                                                   |
| Faker             | ✅     | `@faker-js/faker`, seeded so failures replay (`AIQA_SEED`)                                    |
| Data builders     | ✅     | `anOrder()`, `aProduct()`, `aCustomer()`                                                      |
| JSON              | ✅     | fixtures and HAR files                                                                        |
| YAML              | ✅     | `packages/test-data-engine/src/files.ts` (`readYaml`), `fw/tests/journeys/data-files.spec.ts` |
| CSV               | ✅     | the same (`readCsv`, RFC 4180, schema-checked)                                                |
| Excel             | ❌     | none                                                                                          |
| Database seeding  | ✅     | `stockProducts` fixture in `data-framework/src/fixtures.ts`                                   |
| Cleanup           | ✅     | the same fixture deletes what it added; unique queues deleted                                 |

## 20. CI/CD

| Item               | Status | Where                                                    |
| ------------------ | ------ | -------------------------------------------------------- |
| GitHub Actions     | ✅     | `.github/workflows/ci.yml`, `docs.yml`, `kubernetes.yml` |
| Azure DevOps       | ✅     | `azure-pipelines.yml` (run result not yet confirmed)     |
| Jenkins            | ✅     | `Jenkinsfile` (Windows one has run)                      |
| Docker             | ✅     | `infrastructure/docker/Dockerfile` (Playwright image)    |
| Docker Compose     | ✅     | `infrastructure/docker/stack.compose.yml`                |
| Kubernetes         | ✅     | Helm chart, suites as Jobs                               |
| Matrix builds      | ✅     | shards, templates, branded browsers                      |
| Parallel pipelines | ✅     | independent CI jobs                                      |

## 21. Observability

| Item               | Status | Where                                                            |
| ------------------ | ------ | ---------------------------------------------------------------- |
| Logging            | ✅     | pino, Loki through Alloy                                         |
| Structured logging | ✅     | JSON log lines with trace ids                                    |
| OpenTelemetry      | ✅     | order-service traces to Tempo; k6 metrics                        |
| Execution metrics  | ✅     | Pushgateway (ADR 0010)                                           |
| Prometheus         | ✅     | `infrastructure/kubernetes/aiqa-stack/templates/prometheus.yaml` |
| Grafana            | ✅     | four dashboards                                                  |

## 22. Security testing

| Item              | Status | Where                                                                                   |
| ----------------- | ------ | --------------------------------------------------------------------------------------- |
| CSP headers       | ✅     | `fw/src/checks/headers.ts`                                                              |
| Cookie validation | ✅     | session cookie flags and tampering (web app)                                            |
| HTTPS             | 🟡     | headers check includes HSTS; no TLS or redirect test of our own                         |
| Security headers  | ✅     | headers check, web app headers, ZAP                                                     |
| Authentication    | ✅     | Keycloak, JWT edge cases                                                                |
| Authorization     | ✅     | 401 against 403, roles in the web app                                                   |
| CSRF              | ✅     | `apps/web/tests/e2e/security.spec.ts` (cross-site form post and foreign Origin refused) |
| XSS checks        | ✅     | the same (stored markup shown as text, no script runs); ZAP passive scan                |

Beyond the list: licence gate, `pnpm audit`, OSV-Scanner, ZAP API scan (ADR 0013).

## 23. Enterprise framework features

| Item                     | Status | Where                                                        |
| ------------------------ | ------ | ------------------------------------------------------------ |
| Dependency injection     | ✅     | fixtures (ADR 0002)                                          |
| Factory pattern          | ✅     | `store/factory.ts` in reporting and healing; `chooseModel`   |
| Builder pattern          | ✅     | test-data builders                                           |
| Strategy pattern         | ✅     | healing strategies (`self-healing-engine/src/strategies.ts`) |
| Singleton                | ✅     | `docs/architecture.md`, design patterns (the parsed env)     |
| Command pattern          | ✅     | `docs/architecture.md`, design patterns (the CLI)            |
| Repository pattern       | ✅     | run and heal repositories (SQLite, JSON, memory)             |
| SOLID principles         | ✅     | `docs/architecture.md`, "SOLID, in this codebase"            |
| Configuration management | ✅     | one env schema, catalog-pinned versions                      |
| Environment management   | ✅     | `.env.example`, target overrides, CI and cluster variables   |

## 24. AI features

| Item                     | Status | Where                                                                 |
| ------------------------ | ------ | --------------------------------------------------------------------- |
| AI locator generation    | ✅     | `fw/tests/ai/locator-generation.spec.ts`                              |
| AI self-healing locators | ✅     | `self-healing-engine` with a model tie-break                          |
| AI failure analysis      | ✅     | Triage agent (eval 28/30)                                             |
| AI bug summary           | ✅     | bug-report task, Run reporter agent                                   |
| AI test generation       | ✅     | Planner and Generator agents                                          |
| AI code review           | 🟡     | Healing review writes the pull-request description; no review agent   |
| AI test data generation  | ✅     | Test data agent                                                       |
| AI screenshot analysis   | ❌     | a vision model is too slow on this CPU (deferred in the Phase 5 plan) |
| AI root cause analysis   | ✅     | Triage labels product, test, flaky or environment with evidence       |
| AI flaky test detection  | ✅     | Flaky hunter agent                                                    |
| AI prioritization        | 🟡     | the accessibility agent ranks findings; no risk-based test selection  |

## 25. Playwright MCP

| Item                       | Status | Where                                                              |
| -------------------------- | ------ | ------------------------------------------------------------------ |
| MCP server setup           | ✅     | `packages/mcp-server` (ours); `fw/.mcp.json` (Playwright's)        |
| Browser control via MCP    | ✅     | Playwright's test MCP server, driven by its agents                 |
| DOM inspection             | ✅     | browser snapshots through MCP                                      |
| Screenshot analysis        | 🟡     | the MCP takes screenshots; nothing analyses them                   |
| Locator generation         | ✅     | the generator agent, our `aiqa new page`                           |
| Natural-language execution | ✅     | the web app's chat over our MCP tools                              |
| AI-assisted debugging      | ✅     | Playwright's healer, our triage                                    |
| AI test generation         | ✅     | as above                                                           |
| Prompt templates           | ✅     | the agents' system prompts, `docs/agents-vs-playwright.md` prompts |
| Memory integration         | 🟡     | the agent run log is kept; no memory fed back into prompts         |

## 26. Playwright test agents

| Item                       | Status | Where                                      |
| -------------------------- | ------ | ------------------------------------------ |
| Planner agent              | ✅     | ran 23 Nov: 23 scenarios, PASS             |
| Generator agent            | ✅     | ran 23 Nov: spec passes 3 runs in a row    |
| Healer agent               | 🟡     | set up and scored; not yet run             |
| Agent workflow integration | ✅     | seed spec, `specs/`, `aiqa agents compare` |

## 27. Developer experience

| Item                   | Status | Where                                          |
| ---------------------- | ------ | ---------------------------------------------- |
| ESLint                 | ✅     | `eslint.config.mjs` with the Playwright plugin |
| Prettier               | ✅     | `.prettierrc.json`, checked in CI              |
| Husky                  | ✅     | `.husky/pre-commit`, `.husky/commit-msg`       |
| lint-staged            | ✅     | `lint-staged` in `package.json`                |
| pnpm                   | ✅     | workspace with a version catalog               |
| VS Code settings       | ✅     | `.vscode/settings.json`                        |
| Recommended extensions | ✅     | `.vscode/extensions.json`                      |
| Scripts                | ✅     | root `package.json`                            |
| CLI utilities          | ✅     | `aiqa`                                         |

## 28. Documentation

| Item                  | Status | Where                                           |
| --------------------- | ------ | ----------------------------------------------- |
| README                | ✅     | root and every package                          |
| Architecture diagram  | ✅     | `docs/architecture.md`                          |
| Folder structure      | ✅     | the README's package table                      |
| Contributing guide    | ✅     | `CONTRIBUTING.md`                               |
| Coding standards      | ✅     | `CONTRIBUTING.md`, "Coding standards for specs" |
| Troubleshooting guide | ✅     | `docs/troubleshooting.md`                       |
| Best practices        | ✅     | the learning path and the labs                  |
| Migration guide       | ✅     | `docs/migration-from-selenium.md`               |

## 29. Learning features

| Item                    | Status | Where                                   |
| ----------------------- | ------ | --------------------------------------- |
| Playwright fundamentals | ✅     | learning stops 01 to 03                 |
| Advanced Playwright     | ✅     | stops 04 to 13                          |
| Interview questions     | ✅     | 51 questions, `aiqa quiz`               |
| Common mistakes         | ✅     | eight break-it labs                     |
| Cheat sheets            | ✅     | `docs/cheat-sheet.md`                   |
| Labs                    | ✅     | `packages/examples/labs`                |
| Sample projects         | ✅     | `aiqa new project` (ui, api, both)      |
| Coding exercises        | ✅     | each lab has an exercise and a solution |

## What is left

Closed in the gap sprint (23 Nov 2026): the ten groups the first audit listed, from browser APIs
to the Selenium migration guide. Each row above points at its spec or page.

Still missing, on purpose:

- **Vue and Angular component testing**: there are no such components here; React components are
  tested with Playwright component testing.
- **Excel data**: rare in Playwright suites; CSV and YAML cover data-driven tests.
- **AI screenshot analysis**: a vision model is too slow on a CPU-only laptop.

Still partial: an environment matrix in one run, a real screen reader, `dot`/`line` reporters, a TLS
test of our own, a review agent, risk-based test selection, memory fed back into prompts, screenshot
analysis through the MCP server, and Playwright's healer (set up and scored, not yet run).
