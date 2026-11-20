# Status

Last full run: 20 Nov 2026, Windows laptop (Dell Latitude 7420), Node 24.22.3 LTS, Playwright 1.65.1, k6 2.4.0.
Sprints 1 to 8 of the plan, the performance sprint, the Kubernetes and monitoring sprint, the contracts sprint and the security sprint are built and have run on the laptop. Agents, the chat app and learning content are not started.

## What was run, and the result

| Check                                                                    | Where                                     | Result                                                                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Type-check (`pnpm typecheck`)                                            | Windows laptop and Linux workspace        | Clean                                                                                                                                  |
| Lint (`pnpm lint`)                                                       | Windows laptop and Linux workspace        | 0 errors, 4 warnings                                                                                                                   |
| Unit tests (`pnpm test:unit`)                                            | Linux workspace, Node 22                  | 132 passed                                                                                                                             |
| Unit tests (`pnpm test:unit`)                                            | Windows laptop, Node 24.22                | 135 passed, none skipped (the six SQLite store contracts now run; they skipped on Node 23.3)                                           |
| API specs (`pnpm test:api`)                                              | Windows laptop, live APIs                 | 18 passed, twice, both recorded in the run history                                                                                     |
| UI specs (`pnpm test:ui`)                                                | Windows laptop, live sites                | 143 tests: 141 passed, 2 skipped on purpose (19 Nov); 1 Firefox flake on 15 Nov                                                        |
| Live model tests (`pnpm test:ai`)                                        | Windows laptop, `qwen2.5-coder:7b`        | 4 passed: failure analysis, bug report, locator generation, test data                                                                  |
| Generated-data API spec with `AI_ENABLED=true`                           | Windows laptop, live API                  | Passed; the booking was written by the model, accepted and read back unchanged                                                         |
| Data suites (`pnpm test:data`) against the Docker stack                  | Windows laptop, Docker Desktop            | 24 passed after one fix (metrics exporter bound to localhost)                                                                          |
| One command (`pnpm stack:test`): build, start, test in a container, stop | Windows laptop, Docker Desktop            | 24 passed, exit code 0                                                                                                                 |
| Prometheus and Grafana                                                   | Windows laptop, Docker Desktop            | Target up; counters matched the run (2 confirmed, 2 rejected, 4 dead-lettered, 1 duplicate); dashboard checked by eye                  |
| `aiqa new page --url` generator                                          | Windows laptop, live SauceDemo login page | Page object (5 role locators) and spec written; the generated spec passed. Files removed after the check                               |
| Run-history dashboard                                                    | Windows laptop                            | Built from the three recorded runs, branch and commit captured; checked by eye                                                         |
| Smoke in Chrome and Edge                                                 | Windows laptop                            | 4 passed in each                                                                                                                       |
| Lighthouse audit (`pnpm test:lighthouse`)                                | Windows laptop                            | Passed against the score floors                                                                                                        |
| Linux visual baseline (Docker `snapshots`)                               | Windows laptop, Docker Desktop            | Created `login-form-chromium-linux.png`                                                                                                |
| GitHub Actions                                                           | GitHub                                    | Run #38 (20 Nov) green in every job: unit, API, 3 UI shards, Chrome and Edge, Lighthouse, visual, browser performance, k6, data suites |

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

## Security sprint (20 Nov)

All run on the Windows laptop with the Docker stack, now including Keycloak 26.7.

| Check                                                     | Result                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm security:licences`                                  | 580 packages, all on the open-source allow-list except one named exception: `sentry` (FSL-1.1, source-available), pulled in by Lighthouse                                                                                       |
| `pnpm security:audit`                                     | No high or critical advisories; the two known moderate ones (glob through Allure, minimatch through typescript-eslint)                                                                                                          |
| `pnpm security:osv` (OSV-Scanner 2.5.1)                   | 703 packages, no issues; the same two findings filtered by `osv-scanner.toml`, with reasons, until 20 Feb 2027                                                                                                                  |
| Auth unit tests (`apps/order-service/tests/auth.test.ts`) | 11 passed, including alg `none`, algorithm confusion (HS256 keyed with the public key) and a token edited after signing                                                                                                         |
| Auth spec against Keycloak (`tests/http/auth.spec.ts`)    | 9 passed with real tokens: 201/200 with the role, 401 with no token (bare challenge), Basic credentials, garbage, wrong audience, expiry, tampered claims and `alg: none`; 403 without the role                                 |
| Data suites (`pnpm test:data`)                            | 51 passed (37 before: 9 auth, 4 limits, 1 headers)                                                                                                                                                                              |
| Pact (`pnpm test:contract`)                               | 7 consumer tests; provider check passed with a real token swapped in for the pact's example                                                                                                                                     |
| `pnpm security:zap` (authenticated)                       | Run 1: 159 requests, 118 rules passed, no injection findings, 3 warnings (one a real bug). Run 2: the header warnings gone, a second 500 found. Run 3, after both fixes: 160 requests, 120 rules passed, 0 warnings, 0 failures |

What the ZAP scan found:

1. **A 500 on `PUT /products/{sku}`.** Prices and stock above 2,147,483,647 (Postgres INTEGER) passed
   validation and failed in the database. The 500 also echoed the database's error message.
2. **The same gap on the Kafka path was worse.** An order with such a price was accepted over HTTP
   (202), then failed inside the consumer, which stops the service without committing the message. On
   restart it read the same message and stopped again: one anonymous `POST /orders` took order
   processing down. Reproduced on the stack before the fix.
3. **Two missing hardening headers**, `X-Content-Type-Options` and `Cross-Origin-Resource-Policy`.
4. **The re-scan found a second 500**: a NUL character (0x00) in a product name, which Postgres text
   cannot store. The new error logging named it at once (`invalid byte sequence for encoding "UTF8"`).
   A NUL in an order line's SKU would have stopped the Kafka path the same way as item 2.

Fixed: every amount is capped at the column's range in the zod contract, product names refuse control
characters (and stop at 200 characters), order-line SKUs follow the same pattern as the URL (so a bad value gets 400 over HTTP and goes to
the dead-letter topic over Kafka), 500s say "internal error" and log the real
message, and every response carries `nosniff` and `same-origin`. After the rebuild the service
recovered by itself: the stuck order went to the dead-letter topic and the partition carried on.
`tests/http/limits.spec.ts` keeps it fixed, including an order queued behind the bad one on the same
partition, which must still be confirmed.

Still true by design: any other error that a message causes every time (not a validation error)
still stops its partition rather than skip the message. Sending such messages to the dead-letter topic
needs a rule for telling permanent errors from passing ones; not built.

## Contracts and clean-up sprint (20 Nov)

All run on the Windows laptop, Node 24.22.3, Docker Desktop.

| Check                                                             | Result                                                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order service unit tests (`apps/order-service/tests/api.test.ts`) | The generated document is valid OpenAPI 3.1 and lists every route; its schemas reject a wrong status, a bad uuid, empty lines and a missing field                     |
| Data suites with the OpenAPI checks (`pnpm test:data`)            | 37 passed (30 before, 7 new): every response the HTTP API can give matched the document the running service publishes, and a deliberately wrong check failed          |
| Pact consumer tests                                               | 7 passed: 5 storefront HTTP interactions, 2 notifications Kafka events                                                                                                |
| Pact provider check (`pnpm test:contract`)                        | Every interaction verified against the running service and the service's event builders; passed again on a second run (the fixed order ids are handled as duplicates) |
| The provider check can fail                                       | With `totalCents` published as a string, the message check failed with `$.totalCents -> Expected '2500' (String) to be an integer`                                    |
| Type-check, lint, format, unit tests                              | Clean; 0 errors and the same 4 warnings; formatted; 173 unit tests passed                                                                                             |
| GitHub Actions run #38                                            | Every job green, including Chrome and Edge, Lighthouse and visual, which had not been confirmed before                                                                |

Clean-up: the stale copy of the workflow in `infrastructure/github-actions/` is replaced by a README
that points to `.github/workflows`; the README has a roadmap; `docs/architecture.md` and eleven
decision records in `docs/adr/` explain the design.

One thing to know: Pact's native core reports anonymous usage unless `PACT_DO_NOT_TRACK=true`, and
its `@scarf/scarf` dependency has an install script that reports installs. The first is set in the
Vitest config and the CI job; the second is in `ignoredBuiltDependencies`, so pnpm never runs it.

## Kubernetes and monitoring sprint (20 Nov)

All run on the Windows laptop: Docker Desktop (WSL 2, cgroup v1), kind 0.33 (Kubernetes 1.37),
Helm 4.3, kubectl 1.36.

| Check                                               | Result                                                                                                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm k8s:up`                                       | Cluster created, both images built and loaded, chart installed; all 11 pods ready                                                                                            |
| `pnpm k8s:test data`                                | 30 passed, inside the cluster                                                                                                                                                |
| `pnpm k8s:test ui` (Chromium on the browser server) | First run 112 passed, 4 failed (service-worker specs, see below). After the fix: 116 passed, 2 skipped on purpose                                                            |
| `pnpm k8s:test load smoke`                          | 120 of 120 checks, 60 orders all confirmed, end-to-end p95 35 ms; recorded in the run history                                                                                |
| Test results in Prometheus                          | `aiqa_run_pass_rate` present for `data`, `ui` and `load` (100 each)                                                                                                          |
| Traces in Tempo                                     | One trace per order: `POST`, then `orders.placed process` (Kafka consumer, parent taken from the message headers), the Postgres transaction and the two MongoDB audit writes |
| Logs in Loki                                        | Every pod's logs, labelled `app`, `pod`, `container`, `suite`                                                                                                                |
| Tempo service graph                                 | `traces_service_graph_request_total` in Prometheus                                                                                                                           |
| Grafana "Test runs" dashboard                       | Provisioned and loading its nine panels                                                                                                                                      |
| Type-check, lint, format, unit tests                | Clean; 0 errors and the same 4 warnings; formatted; 168 unit tests passed                                                                                                    |
| Docker stack config after the files moved           | `docker compose config` valid; every mounted file found                                                                                                                      |

What came up:

1. **kind would not start on this laptop.** Docker Desktop's WSL 2 kernel still uses cgroup v1, and
   the kubelet in Kubernetes 1.35 and later refuses cgroup v1 by default. `pnpm k8s:up` detects
   it and sets `failCgroupV1: false` for the kind node, with a warning. The lasting fix is to move
   WSL to cgroup v2 (`infrastructure/kubernetes/README.md` shows how); that is a Windows setting,
   left to the owner of the machine.
2. **Specs that start their own local server failed on the remote browser.** The service-worker
   specs serve a page on `127.0.0.1` inside the test Job, but the browser runs in another pod, where
   that address is the browser's own. `connectOptions.exposeNetwork: '<loopback>'` makes Playwright
   tunnel the browser's localhost traffic back to the test runner, and all four passed.
3. **Helm mangled Windows paths in `--set-file`** (backslashes are escapes in `--set` values), so
   the k6 script was not found. The script path now goes in with forward slashes.
4. **OpenTelemetry JS 3 replaced `sdk-trace-node`** with `@opentelemetry/sdk-trace`, and
   `BatchSpanProcessor` now takes an options object (`{ exporter }`). The type-check caught it.

## Performance sprint (19 to 20 Nov)

All run on the Windows laptop, Node 24.22.3, Docker Desktop.

| Check                                                   | Result                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:perf` (6 specs, Chromium, one at a time)     | Passed in both runs with the final budgets (after three measuring runs). Login LCP 324 to 404 ms; INP 24 to 32 ms; slow-phone LCP 2,044 to 2,184 ms |
| Page-weight budget                                      | Identical in every run once images had loaded: 10 requests, 730 KB decoded, 550 KB of it scripts                                                    |
| Memory-leak check                                       | 4.2 to 4.3 KB per round, steady; budget 8 KB                                                                                                        |
| Data suites with the new HTTP API and concurrency specs | 30 passed (24 before, 5 for `POST /orders` and `PUT /products/:sku`, 1 for concurrent orders)                                                       |
| `pnpm perf:load smoke`                                  | Every threshold held: 60 orders, all confirmed, end-to-end p95 33 ms                                                                                |
| `pnpm perf:load load` (20 orders a second)              | Every threshold held: 3,360 orders, all confirmed, 0 failed requests, both endpoints about 4 ms at p95                                              |
| `pnpm perf:load stress` (to 150 a second)               | First run: thresholds crossed (see below). After the two fixes below: every threshold held                                                          |
| `aiqa perf`, dashboard section                          | Trends and verdicts from the recorded runs                                                                                                          |

What the stress runs found, in order:

1. **The first run measured mostly the load test.** It showed about 35 orders a second confirmed,
   end-to-end p95 32.5 s and 80% confirmed, but the script polled every 25 ms: 1,600 reads a second
   against the service's five Postgres connections. With polling that backs off, the same service
   peaked at 99 orders a second (Prometheus `orders_processed_total`), confirmed all 13,733 orders,
   and crossed only the end-to-end threshold (p95 7.54 s, 2,316 orders dropped).
2. **The service handled Kafka messages one at a time.** It now handles its three partitions in
   parallel, one message at a time within each, so everything about one order stays in order
   (`apps/order-service/src/partitions.ts`, unit-tested). Offsets are committed after handling, at
   most once a second per partition, instead of automatically on read.
3. **That exposed a deadlock**, which stopped the service in its first parallel stress run: two
   orders reserving the same products in opposite line order. Stock is now reserved in SKU order,
   and a transaction Postgres aborts as a deadlock victim is retried up to three times
   (`order_transaction_retries_total`; zero in every run since). `tests/flows/concurrency.spec.ts`
   places 60 orders with crossed product order at once: it failed 3 of 3 runs on the deadlocking
   build and passes 5 of 5 on the fixed one.

| Stress profile, same script and laptop | One message at a time | Partitions in parallel |
| -------------------------------------- | --------------------- | ---------------------- |
| Peak orders handled a second           | 99                    | 132                    |
| Orders completed                       | 13,733                | 15,817                 |
| Order end-to-end p95                   | 7.54 s                | 1.31 s                 |
| Orders k6 had to drop                  | 2,316                 | 233                    |
| Thresholds                             | end-to-end crossed    | all held               |

The stress profile offers at most 150 orders a second, so 132 is not the new ceiling, only what this
run needed. `PARALLEL_PARTITIONS=false` brings back the old behaviour to compare.

Corrections made on the way:

- **Web Vitals came back empty at first.** Playwright runs each init script in its own scope, so the
  library's top-level `var webVitals` never reached `window`. The injected script now assigns it.
- **The first leak check read 22.5 KB per round on TodoMVC.** A probe showed growth front-loaded and
  the same with plain in-page events (439 KB over 20 rounds, 157 KB over the next 40): warm-up, not a
  leak. The check now warms up for 20 rounds and measures 40.
- **Page weight varied from 4 to 10 requests** because product images arrive after the load event.
  The spec now waits until every image has loaded.
- **The k6 script measured its own polling.** Polling every 100 ms reported a 121 ms p95 for orders
  that took about 30 ms; polling every 25 ms then sent 1,600 reads a second in the stress run and
  slowed the endpoint it was timing. It now starts at 25 ms and backs off to 500 ms.
- **One stress reading was negative** (-3.97 s): Docker's virtual machine clock went backwards under
  load. Such readings are now counted (`clock_jumps`) instead of averaged in.
- **A verdict on one earlier run is noise.** The trend analysis waits for 3 earlier runs.
- **Grafana 13 read dashboard files only at start-up** here; the provisioning now rescans every 10 s.
- **The first GitHub run failed the slow-phone spec: "lcp_ms: not measured".** Reproduced in the
  project's Linux image limited to 2 CPUs (2 failures in 22 runs, the unthrottled login page too):
  the library's LCP report had not arrived when the page was told it was hidden. `collectWebVitals`
  now waits up to 5 s for it, then lets the final reports run. No "not measured" in the next 42 runs.
- **The same runs showed the slow-phone budget was set from laptop numbers.** With the CPU slowed 4x,
  LCP was 2.0 to 2.2 s on the laptop but 2.0 to 3.6 s on 2-CPU Linux. The budget is now Google's
  "poor" line (4 s), as for the other pages, and FCP is recorded without a budget. INP is likewise held
  to "not poor": one interaction in twenty passed 200 ms on 2 CPUs.

On GitHub Actions the first run passed the `load` job (k6 smoke) and failed `perf` as described below.
Not yet seen: both Azure pipelines' new jobs and the Jenkins `RUN_PERF` / `LOAD_PROFILE` parameters.

## Clean-up sprint (19 Nov)

- **Node 24 LTS** (24.22.3) on the laptop, in CI (`.nvmrc`) and in the order-service image. `engines`
  now asks for Node 22.22+ or 24.6+. On Node 24 the SQLite stores work and their tests run; API (18),
  UI (141 passed, 2 skipped on purpose), unit (135) and data (24) suites all pass.
- **kafkajs replaced by `@platformatic/kafka`** 2.17 (maintained, pure TypeScript, Apache-2.0) in the
  order service and the test bus. The topics spec no longer reaches into the client library: `KafkaBus`
  gained `collect`, `partitionCounts`, `createTopic` and `deleteTopic`, so a future swap really is one
  file. The library's README lists Kafka 3.5 to 4.2 as tested; all 24 data tests pass against the stack's
  Kafka 4.3.2, on the host (18.1 s, was 25.6 s) and in the `stack:test` container (12.3 s).
- **The order service stops cleanly.** It ran under `pnpm start`, and a normal `docker stop` was
  reported as exit code 1 by the pnpm and tsx wrappers. The image now runs `node --import tsx` directly
  and exits 0.
- **GitHub Actions run #34 was green in every job**, including `data`, `branded`, `lighthouse` and
  `visual`. Run #33 failed only in `api` and the same code passed in #34: a live Restful-Booker blip.
- **Jenkins** runs the project on the laptop (job `AI-QA-Platform`, `infrastructure/jenkins/Jenkinsfile.windows`):
  build #2 passed install, quality, API and the 24 data tests; build #1 passed the 143-test UI suite.
- The `kubernetes` and `monitoring` READMEs now say what is built and what is planned.

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
- Seen green on GitHub in run #34.

## Not run yet

- **Azure DevOps.** Set up on the "Learn DevOps" project with a self-hosted agent on the laptop
  (Windows pipeline) and a request for Microsoft's free hosted grant. The result of its runs has not
  been confirmed from here. The root `Jenkinsfile` (Linux Jenkins with Docker) has not run; the
  Windows one has.
- **The Playwright test agents** are initialised (`.claude/agents`, `.mcp.json`, `tests/seed.spec.ts`,
  which passes). No plan or test has been generated with them yet.
- **Firefox and WebKit run journeys and smoke only**; the labs run on Chromium by design.
- **No CI job runs the cluster yet.** Everything Kubernetes has run on the laptop only; a manual or
  nightly GitHub job with kind is possible but not built.
- **The UI Job runs Chromium only.** The browser server runs one Playwright version and serves any
  browser it has installed, but only the `chromium` project has run against it.

## Known gaps and honest notes

- **pnpm links fail intermittently on the laptop** ("EPERM: operation not permitted, symlink"), with
  pnpm 10 as well as 12, and with Defender real-time protection off. Likely cause, not proven: VS Code
  was running a Playwright test server and an ESLint bridge out of this `node_modules`, holding files
  open while pnpm relinked them. Retrying gets through: `scripts/install-windows.ps1` retries
  `pnpm install` and creates any link pnpm names (it needed 5 attempts for the Playwright 1.65.1
  update). Closing VS Code before an install is worth trying first.
- **Kafka 4.3 is newer than `@platformatic/kafka` lists as tested** (3.5 to 4.2). Every data test
  passes against 4.3.2; if a later broker update breaks something, pin the `apache/kafka` image back
  to 4.2 in `stack.compose.yml`.

- **The model is slow on this CPU**: about 40 seconds per call with `qwen2.5-coder:7b`. Raise
  `OLLAMA_TIMEOUT_MS` on slower machines. AI stays off by default and every AI task has a fallback.
- **Two moderate advisories remain** in `pnpm audit`: `minimatch` (through ESLint) and `glob` (through
  the Allure CLI). The fixed versions are a major ahead of what those tools accept, which is why
  Dependabot's two security updates failed. Both are build-time tools reading this repository's own
  files. They clear when ESLint and Allure release updates.
- **`_react=` and `_vue=` selectors do not work in Playwright 1.65** (the engines are gone), so that row
  of the plan cannot be built. Legacy layout selectors are covered instead.
- **Node 23.3 is no longer supported here.** Its `node:sqlite` needs a flag (the stores fall back to
  JSON files), it is outside what Vitest 5 and ESLint 10 support, and `@platformatic/kafka` needs
  22.22+ or 24.6+. Use Node 24 LTS (`nvm use 24.22.3` on the laptop).
- **The cluster keeps no data.** Postgres, MongoDB, Kafka, Prometheus, Loki and Tempo use
  `emptyDir`, so `pnpm k8s:down` (or a pod restart) starts them empty. Test reports and k6
  summaries are kept: they are written to `.aiqa/k8s/` on the laptop through a kind mount.
- **k6's Prometheus remote-write output is deprecated** (planned for removal in k6 3, with
  OpenTelemetry as the replacement). It works in k6 2.4; moving to OpenTelemetry means reading
  histograms instead of ready-made percentiles in Grafana.
- **The browser performance specs measure public sites over the internet.** Their timing budgets are
  Google's "poor" thresholds, not "good", so a slow connection does not fail them; the trends catch drift.
- **The project carries pnpm as a dev dependency** (corepack failed on Node 23.3); `npx pnpm ...` works
  on any Node.
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
  `pg`, `mongodb`, `kafkajs` (replaced by `@platformatic/kafka` on 19 Nov), OpenTelemetry metrics with the Prometheus exporter, `commander`, `tsx`.
  The plan's `testcontainers` was not used: the stack is Docker Compose, which CI runners and the
  laptop already have, and one stack serves every suite.
- Added later: `lighthouse`, `cross-env`, `tslib`, the `lighthouse` and branded browser projects,
  a `snapshots` Docker service, Dependabot config, and the `branded`, `lighthouse` and `visual` CI jobs.
