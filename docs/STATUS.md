# Status

Last full run: 23 Nov 2026, Windows laptop (Dell Latitude 7420), Node 24.22.3 LTS, Playwright 1.65.1, k6 2.4.0.
Sprints 1 to 8 of the plan, the performance sprint, the Kubernetes and monitoring sprint, the contracts sprint, the security sprint and the learning sprint are built and have run on the laptop. Phase 5: Sprints 9 (agent runtime, Triage agent, MCP server), 10 (Planner, Generator, Healing review), 11 (Flaky hunter, API tester, Test data, Accessibility, Run reporter, and live evals for all nine agents), 12 (the web app's dashboard, Keycloak sign-in, shared components with component tests), 13 (chat over the MCP tools with approvals, admin area, tests for AI features) and 14 (docs site, project templates, the web app in Kubernetes, healing patches and branch) are built and have run. Phase 5 is complete. After it: a nightly cluster workflow, RabbitMQ and gRPC suites, PDF reports, k6 over OpenTelemetry, three engines in the cluster, and the agents measured on `qwen3:8b`. Then a capability audit against an enterprise Playwright checklist, and a sprint that closed 40 of its gaps.

## What was run, and the result

| Check                                                                    | Where                                     | Result                                                                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Type-check (`pnpm typecheck`)                                            | Windows laptop and Linux workspace        | Clean                                                                                                                                  |
| Lint (`pnpm lint`)                                                       | Windows laptop and Linux workspace        | 0 errors, 0 warnings                                                                                                                   |
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

## Mobile Sprint M2: native depth (24 Nov)

**Built:** screen objects for ApiDemos (`src/screens/apidemos.ts`) and 26 new tests. Against
ApiDemos: check boxes, radio buttons, star, toggles, spinner, seek bar and rating bar; a popup menu,
its submenu, a long-press context menu, toasts; scrolling a list to an item with `UiScrollable`, and
the same screen reached through the menus and by its activity; the notification shade; device
state (orientation, clipboard, geolocation, Wi-Fi off and on, device and battery info); uninstall
and reinstall. Against the demo app: the permission dialog (deny, allow while using, granted from
outside the app), data kept or lost across a restart and after "Clear storage", and deep links.
Hybrid WebView and pinch move to M3; [the plan](mobile-plan.md) lists what else did.

**Run**

| Check                                       | Where           | Result                                       |
| ------------------------------------------- | --------------- | -------------------------------------------- |
| Unit tests (whole repository)               | Linux workspace | 396 passed, 1 skipped                        |
| Fake-driver suite                           | Linux workspace | 8 passed                                     |
| Type-check, lint, Prettier, `agents review` | Linux workspace | Clean (one title reworded)                   |
| Whole mobile suite on the emulator, twice   | Laptop, API 34  | 48 passed both times (8.3 min, then 8.2 min) |

**Found on the emulator**

- **A defect in ApiDemos.** It targets SDK 33 but does not declare `POST_NOTIFICATIONS`, so Android
  13 and later block every notification it posts. The shade test posts from Android's shell
  instead (`cmd notification post`), which needs the Appium server's `adb_shell` feature. That
  feature runs any shell command on the device, so it is switched on for this server only, which
  listens on 127.0.0.1.
- **Shell arguments.** `mobile: shell` joins its arguments into one command line on the device, so
  a title with spaces arrived as "Order" with the text "shipped". Each argument is now quoted for
  the device's shell.
- **Bundled notifications.** Once an app has several notifications, System UI groups them and the
  title moves from `android:id/title` to `com.android.systemui:id/notification_title`. The test
  looks for both and uses a new order number each run, so a leftover cannot pass it.
- **Dropped gestures.** In the first two-run sign-off, two tests failed once each and passed in the
  other run: the shade ignored a dismiss swipe (the recording shows the notification still there),
  and the carousel ignored a swipe (the M1 test, which had passed in every earlier run). Both now check the
  result and repeat the gesture only if nothing changed: the carousel swipe once more, the
  notification fling up to three times. A gesture that worked is never doubled, and the tests still
  check the exact card and that the notification is gone. Each passed three times in a row; the
  two-run sign-off was then started again from the beginning.
- **Evidence timing.** The failure evidence is taken after `afterEach`, which had already closed the
  shade, so the screenshot showed ApiDemos instead of the shade; the screen recording showed it.
- **Toasts** are found by their text in the locator and checked for presence. Reading the text of
  a toast element found earlier fails, because the toast has already gone.
- **Menus.** "Edit" in the popup menu is a submenu (Edit header, Share), not a plain item; the
  context menu's header is `android:id/title`.
- **Deep links** sent before React Native has loaded are dropped; the test waits for the home
  screen first. Right after "Clear storage", Android can ignore the first launch, so the reset
  retries it.
- **The demo app's empty texts differ:** memory shows "— empty —", the disk stores "— nothing saved
  yet —".
- **Permissions** can be read and changed with `mobile: getPermissions` and `changePermissions` on
  the Google Play image, which has no root.
- **Jenkins #31's Firefox failure** was load on the laptop from the Android SDK install that ran at
  the same time; the same tests passed locally and Jenkins #32 passed (Firefox 21 of 21).

## Mobile Sprint M1: the foundation (24 Nov)

The plan is [docs/mobile-plan.md](mobile-plan.md): Appium 4.0.1 and the UiAutomator2 driver 10.0.0,
driven by WebdriverIO 10.2 inside Playwright Test fixtures, on an Android emulator, against
WebdriverIO's native demo app (MIT) and Appium's ApiDemos (Apache-2.0).

**Built:** `packages/mobile-framework`. An Appium server per worker, started from the package's own
`node_modules` with `APPIUM_HOME` pointing at the package, so the pinned drivers are the ones
loaded and nothing is installed globally. One session per worker; the app is relaunched before
each test. On failure the report gets a screenshot, the UI tree, logcat, that test's Appium log
and the screen recording. Screen objects for the demo app (accessibility IDs from its source).
21 Android tests: navigation, sign-in and sign-up, form controls, system alerts, swipe, scroll,
drag and drop, and the app lifecycle. 8 framework tests against Appium's fake driver, which need
no device. 13 unit tests. `pnpm mobile doctor | apps | emulator`.

**Checked before choosing:** WebdriverIO 10 names Appium 3 as its minimum and says nothing about
Appium 4, which went stable on 15 Nov. A WebdriverIO 10.2 session against Appium 4.0.1 passed
every call the framework uses, so the current versions were kept; Appium 3.9.1 with UiAutomator2
8.7.3 is the fallback. Both app downloads match their published SHA-256.

**Run**

| Check                                | Where              | Result                                                                                                                  |
| ------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Fake-driver suite                    | Linux workspace    | 8 passed                                                                                                                |
| Unit tests (whole repository)        | Linux workspace    | 393 passed, 1 skipped                                                                                                   |
| Type-check, lint, Prettier, licences | Linux workspace    | Clean; 3 new licence exceptions, each with its reason                                                                   |
| `pnpm mobile apps`                   | Linux workspace    | Both apps downloaded, hashes verified, second run skips                                                                 |
| Android project without a device     | Linux workspace    | Stops at the `device` setup step with the list of fixes                                                                 |
| Install, type-check, lint, licences  | Laptop             | Clean (1003 packages, 4 named licence exceptions)                                                                       |
| Unit tests (whole repository)        | Laptop, Node 24.22 | 394 passed                                                                                                              |
| Fake-driver suite                    | Laptop             | 8 passed                                                                                                                |
| `pnpm mobile doctor --accel`         | Laptop             | SDK, JDK 26, driver and emulator found; WHPX usable. Missing: the system image, the `aiqa_api34` emulator, the two apps |
| Android suite on the emulator, twice | Laptop, API 34     | 22 passed both times (7.0 min, then 4.7 min)                                                                            |

**Found on the way**

- The test image does a frozen install of the packages it lists; the mobile package is left out on
  purpose (Appium and the driver would add about 50 MB), and the one unit test that needs the
  drivers skips there.
- WebdriverIO 10 no longer has `isW3C` (every session is W3C), and Appium returns capabilities
  without the `appium:` prefix. The fake-driver suite caught both.

**On the emulator (24 Nov).** Each finding was checked against the app's real UI tree, saved by a
probe that opens every screen, not guessed from the app's source:

- **Speed.** UiAutomator2 waits for the app to go idle before every step; a React Native app with
  animations never does, so each step waited for the timeout. `settings[waitForIdleTimeout]: 0`
  took a five-screen tour from minutes to 36 s.
- **Alerts.** React Native shows AndroidX dialogs: the title's ID is the app's own
  (`com.wdiodemoapp:id/alert_title`), not `android:id/alertTitle`, and Android draws button labels
  in capitals.
- **An accessibility bug in the app.** The Inactive button is disabled in React Native only;
  Android reports it enabled, so a screen reader announces it as usable. The test checks what the
  user gets (a tap does nothing) and the comment records the bug.
- **Carousel.** Titles are upper-cased by the app, and sit next to the `card` view rather than
  inside it. Hand-built W3C touch moves did not move the carousel or scroll the page;
  UiAutomator2's own `mobile: swipeGesture` and `mobile: scrollGesture` do, and stay away from
  the screen edges.
- **The notification shade.** One stray swipe from the top edge pulled it down and hid the app from
  every later test. Each test now starts by collapsing it (`mobile: statusBar`).
- **Puzzle.** The success view fires confetti drawn over it, which swallows taps for about 3 s and
  makes "is displayed" flicker. Retry taps until the puzzle is back; "solved" checks presence.
- **Cold start.** After a reboot, loading the UiAutomator2 driver took 109 s (cold disk cache,
  Windows Defender scanning each file) against 15 s warm; the server now gets 3 minutes.
- **A cold emulator boot** can take longer than Appium's wait; the run script boots the emulator
  first and waits for `sys.boot_completed` (64 s on the laptop).
- **The laptop shut itself down at 12:18** (a Windows-initiated power off, not a crash), mid-run.

## AI features, audit fixes and a walkthrough (23 to 24 Nov)

Before the mobile sprint: the AI items the audit marked partial, its small fixes, a decision on
what to leave out, and a way to show the platform in ten minutes. Payments testing is not in scope.

**Built**

- Agents learn from people: `aiqa agents feedback triage <id> <label>` records a decision in
  `.aiqa/agents/decisions.jsonl`. Triage answers an exact repeat from it before the rules, and gives
  the model similar past decisions as examples. Healing review skips a fix someone declined before.
- Risk-based test selection: `aiqa select` reads the import graph and `test-impact.json`, ranks the
  specs a change can break by run history, fits a time budget, and prints the commands. It names
  changed files that only unit tests cover, and files nothing covers.
- Test review: `aiqa agents review` checks changed specs against 12 house rules (fixed waits, XPath,
  force clicks, tokens in code, and more), adds the model's findings, and writes a pull-request
  comment. Exit code 1 on a must-fix. The repository has 0 findings across 120 spec files.
- Small fixes: a TLS edge (Caddy) in front of the order service with a TLS spec (1.3 and 1.2 only,
  certificate, redirect, HSTS); the same smoke checks against Docker and Kubernetes (`pnpm
test:matrix`); a console reporter chosen by `PW_CONSOLE_REPORTER`.
- [ADR 0017](adr/0017-what-the-platform-leaves-out.md): Vue, Angular, Excel and AI screenshot
  analysis are left out on purpose.
- [The ten-minute walkthrough](walkthrough.md) and `scripts/demo-frames.mjs`, which captures the
  demo frames.

**Run on the laptop**

| Check                                     | Result                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Type-check, lint, Prettier, licences      | Clean                                                                 |
| Unit tests                                | 381 passed                                                            |
| `aiqa select` on this branch              | 66 files changed, includes the lockfile: run everything (correct)     |
| `aiqa select` for the cart page object    | 1 spec (checkout), with its real history                              |
| `aiqa agents review` on the changed specs | Nothing to change                                                     |
| UI specs touched by the review comments   | 31 passed, 1 skipped on purpose                                       |
| Data suites with the TLS edge             | 69 passed, TLS 5 of 5                                                 |
| Environment matrix, Docker and kind       | 10 of 10 (9 of 10 before the fix below)                               |
| Helm render                               | `AUTH_ISSUER` and `AUTH_JWKS_URL` set when Keycloak is on             |
| In-cluster data Job, auth on              | 64 passed, 5 skipped (the TLS spec: no edge in the cluster)           |
| Demo frames and `docs/assets/demo.gif`    | 5 frames from real runs; GIF joined with ffmpeg (the laptop has none) |

**What the runs found**

- The matrix found that the order service in kind accepted product writes without a token: the chart
  never set `AUTH_ISSUER`. The chart now points the service and the test Jobs at the in-cluster
  Keycloak.
- The edge's health check called `localhost`, which resolved to IPv6 where Caddy's admin port does
  not listen. It now calls `127.0.0.1`.
- The TLS spec ran inside the cluster, where there is no edge. The chart now sets
  `EDGE_HTTPS_URL=none` and the spec skips there.
- The token-expiry test in the cluster failed once and passed on retry; it waits for a short-lived
  token to lapse, so it is timing-sensitive under load.
- `demo-frames` ran `pnpm` through a shell, which found nvm's old corepack and failed. It now runs
  the CLI with this node and tsx.

## CI on the laptop: Docker update, two pipelines at once, a stray folder (23 Nov)

Jenkins #25 to #27, the Azure DevOps Windows run and two Dependabot updates failed on the evening of
23 Nov. None of it was a product bug:

- **Docker Desktop updated itself (4.100.1) at 19:31 IST**, in the middle of Jenkins #26: it stopped
  the containers and the engine, installed, and did not start again. #26 failed at Keycloak, #27 marked
  itself unstable and skipped the data suites (as designed), and Azure DevOps failed its Docker check.
- **The Azure DevOps Docker check failed instead of warning**: Windows PowerShell turns docker's stderr
  into a terminating error under the task's default `stop`, and the task fails on the exit code. It now
  runs with `errorActionPreference: continue` and `ignoreLASTEXITCODE: true`.
- **Jenkins and Azure DevOps build every push on the same laptop at the same time**: twice the
  browser load (Jenkins #25's Firefox timeouts) and one shared Docker stack that the first to finish
  takes down. Both now take a machine-wide lock first (`scripts/ci-lock.mjs`, a file created
  atomically in ProgramData, released at the end, taken over after 150 minutes if a build died), so
  the second one waits.
- **Azure DevOps run 20261123.12**, the first after the fixes above, failed at "order service is
  unhealthy" 11 seconds after it started; Jenkins #28 straight after it was green (order service ready
  in 9.5 s, no restarts). The health check had no start period, and `compose --wait` printed no reason.
  Now the check has `start_period: 60s` (checked every second until the first pass), and `stack:up`
  (`scripts/stack.mjs`) prints the state and last log lines of every service that is not healthy, then
  tries once more without rebuilding. On the laptop after the change: stack up first time, data suites
  64 of 64, unit tests 342.
- **Dependabot** failed on `/playwright-mcp`: a copy of the Playwright MCP files had been committed in
  a folder of that name, with its own `package.json` and lockfile. The folder is removed.

## Playwright MCP with every capability (23 Nov)

`@playwright/mcp` is registered in the root `.mcp.json` as `playwright`, with all eight capabilities
(core, network, storage, testing, vision, PDF, DevTools, config: 72 tools). Every release of it pins an
alpha Playwright, so an override runs it on the repository's 1.65.1 (release 0.0.84, built on 1.65):
one Playwright, one set of browsers. See [Playwright MCP](playwright-mcp.md).

| Check                                                                | Where                     | Result                                                                                                      |
| -------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tool groups (`tests/playwright-mcp.test.ts`, in `pnpm test:unit`)    | Linux workspace           | 5 passed: 72 tools with the config, 25 core without it                                                      |
| Every group against a local orders page (`pnpm test:mcp:playwright`) | Linux workspace, Chromium | 8 passed: snapshot refs, form fill, verify, locators, storage, mocked API, click by coordinates, trace, PDF |
| Lint, type-check, unit tests, licences                               | Linux workspace           | Clean; 331 unit tests; 874 packages allowed                                                                 |
| The same on the Windows laptop                                       | Windows laptop            | Clean: one `playwright-core` (1.65.1), 332 unit tests twice, live 8 of 8, docs and licences                 |

On the laptop the first unit run timed out two `heal-branch` tests (real `git` commands, 5 s limit,
with the new MCP tests starting processes alongside), and the live test's clean-up waited on the
browser's open connections. The git tests now allow 30 s and the clean-up closes those connections;
both runs after that were clean.

## Capability gap sprint (23 Nov)

The [capability audit](capability-audit.md) scored the repository against a 283-item enterprise
Playwright checklist: 230 built, 24 partial, 29 missing. This sprint closed 40 of the 53; the audit now
reads 270 / 9 / 4, and the four still missing are left out on purpose (Vue, Angular, Excel, AI
screenshot analysis).

Built:

- **Browser APIs** on a local https page (`src/local/site.ts`): clipboard granted and refused, WebAuthn
  with a CDP virtual authenticator, notifications (full Chromium: the headless shell has none), a fake
  camera and microphone.
- **Devices**: a `tablet` project (iPad Pro 11, WebKit) for the smoke specs; touch with `hasTouch`,
  `tap()` and a CDP swipe.
- **Files, network, visual**: several uploads and the `filechooser` event, the downloaded CSV's content,
  request modification (headers, method, body, `route.fallback`), full-page screenshots, `mask`, `style`
  and `stylePath`.
- **Debugging**: `pnpm test:debug`, an automatic `networkLog` fixture that names slow requests and
  attaches every request of a failed test, trace chunks, `page.pause()` behind `PWDEBUG`.
- **State and data**: IndexedDB in storage state, a `cleanup` teardown project, CSV and YAML readers
  in the test-data engine (schema-checked, errors name the file, row and field) with a data-driven spec.
- **Security of our own web app**: CSRF from a page on another site and from a foreign Origin, both
  refused while the admin is signed in; stored markup in a test title shown as text, never run.
- **Docs and editor**: `CONTRIBUTING.md` with the coding standards, a troubleshooting page, a cheat
  sheet, a Selenium-to-Playwright guide, design patterns and SOLID in the architecture page,
  `.vscode` settings and recommended extensions.

| Check                               | Where          | Result                                                                                  |
| ----------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| Install, type-check, lint, licences | Windows laptop | Clean (873 packages, `yaml` 2.9.1 added)                                                |
| Unit tests                          | Windows laptop | 327 passed (19 new for the CSV and YAML readers)                                        |
| Prettier                            | Windows laptop | Repository clean (only the local, git-ignored `.claude/settings.local.json` is flagged) |
| Docs site build and link check      | Windows laptop | 41 pages, every internal link resolves                                                  |
| Nine new feature specs, Chromium    | Windows laptop | 25 passed                                                                               |
| CSV and YAML data-driven spec       | Windows laptop | 12 passed (SauceDemo)                                                                   |
| `tablet` project (smoke)            | Windows laptop | 5 passed                                                                                |
| Visual specs with `stylePath`       | Windows laptop | 4 passed, baselines unchanged                                                           |
| Web app (`pnpm test:web`, Keycloak) | Windows laptop | 43 passed, including the 3 new security specs                                           |

The screenshot spec was also repeated three times in the Linux workspace (9 of 9).

## After Phase 5: six improvements (23 Nov)

Built, then run on the Windows laptop:

1. **A nightly cluster workflow** (`.github/workflows/kubernetes.yml`): kind and Helm on a GitHub
   runner, `pnpm k8s:up`, then the data, UI (Chromium, Firefox, WebKit) and load suites as Jobs, with
   the reports kept as an artifact. Its first run on GitHub (23 Nov) built the stack and passed the
   data and UI steps, then failed at the load step: see the fix below.
2. **The nine agent evals on `qwen3:8b`**, thinking off (`AGENT_THINK=false`, new: qwen3 reasons
   before every answer by default, several times slower on a CPU).
3. **Playwright's planner, generator and healer against ours**: `pnpm aiqa agents compare plan | spec
| heal-task | heal` scores both sides with the checks our evals use; the healing score also fails a
   fix that weakens an assertion. Runbook: [agents-vs-playwright.md](agents-vs-playwright.md).
4. **k6 metrics over OpenTelemetry** into Prometheus's OTLP receiver, replacing the remote-write
   output k6 3 removes. The "Load tests" dashboard now works its percentiles out from histograms.
5. **Firefox and WebKit in the cluster**: `pnpm k8s:test ui all-browsers`; the browser server gets
   1 CPU and 2 GiB for three engines.
6. **The items the Phase 5 plan deferred**: RabbitMQ (the order service fans each outcome out on
   the topic exchange `orders.events`; suites for its notifications and for dead-lettering, expiry,
   redelivery, mandatory returns and prefetch), a gRPC API (`proto/orders.proto`: place, read, and a
   stream that follows an order until it is decided; suites for status codes, deadlines and
   agreement with HTTP), and PDF reports (`pnpm report:pdf`, the run-history dashboard printed by
   Chromium in a print layout).

| Check                                  | Result                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Typecheck, lint, prettier, docs build  | passed                                                                                        |
| Unit tests                             | passed (319 in the workspace: gRPC handlers, compare scoring, PDF input, agent fixes)         |
| Licence gate                           | all allowed (873 packages in the workspace, with `amqplib` and `@grpc/*`)                     |
| Data suite, Docker (`pnpm test:data`)  | 64 tests; the 9 RabbitMQ ones passed after the fix below, gRPC passed first time              |
| Data suite in the cluster              | 55 passed, 9 skipped (the Keycloak tests; the cluster's order service has no auth, as before) |
| UI smoke in the cluster, three engines | passed on Chromium, Firefox and WebKit through the shared browser server                      |
| k6 smoke, Docker and cluster           | 61 of 61 orders confirmed, 0 failed requests; every `k6_*` metric in Prometheus               |
| Grafana's p95 against k6's own         | 49.7 ms (from the histogram) against 46 ms (exact)                                            |
| GitHub Actions after the push          | CI #66 and the docs site workflow passed; the site is live                                    |
| PDF report                             | spec passed; `report:pdf` wrote the full (46 runs) and data-suite (14 runs) reports           |
| Helm                                   | `helm lint` passed; the chart now renders RabbitMQ and the gRPC port                          |

Agent evals, `qwen3:8b` (thinking off) against `qwen2.5-coder:7b` (Sprint 11), same cases and gates:

| Agent          | qwen3:8b        | qwen2.5-coder:7b | Notes                                                                              |
| -------------- | --------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Triage         | 27/30, 6.0 min  | 28/30, 9.7 min   |                                                                                    |
| Flaky hunter   | 6/8, 6.3 min    | 8/8, 10.3 min    | at the 75% gate exactly                                                            |
| Accessibility  | 9/10, 3.5 min   | 9/10, 10.1 min   |                                                                                    |
| Run reporter   | 4/5, 3.5 min    | 4/5, 4.8 min     |                                                                                    |
| Test data      | 8/8, 5.0 min    | 8/8, 3.3 min     | after the fix below; the first run scored 4/8, every miss a made-up UUID           |
| Healing review | 3/3, 3.6 min    | 3/3, 2.3 min     |                                                                                    |
| Planner        | 2/2, 5.3 min    | 2/2, 5.3 min     |                                                                                    |
| Generator      | 0/1, 6.7 min    | 1/1, 3.0 min     | after the type check below; qwen3 now writes code that compiles but never signs in |
| API tester     | 11/13, 10.1 min | 11/11, 35.8 min  | one case broke the schema, one called `/orders/` with no id                        |

`qwen3:8b` with thinking off scores the same as `qwen2.5-coder:7b` on six agents, one lower on
triage, and two lower on the flaky hunter (still at its gate), and it is two to three times faster on
most. Its weak spot is writing code against an API it has only seen in examples; both changes it
prompted are to the agents, not to the evals.

Fixed on the way:

- **RabbitMQ 4 refuses transient queues that are not exclusive** (`transient_nonexcl_queues` is a
  removed feature). The suite's helper now makes durable queues and deletes them after each test.
- **A ratio panel showed "no data" instead of 0%** when nothing failed (no `condition="nonzero"`
  series exists then); the queries add `or vector(0)`.
- **The test data agent now fills ids and timestamps itself** from the seeded builder; no edge is
  about them, and a small model writes them badly. The model writes only the fields the edges are about.
- **A failed generator run now logs its real error** (the lines under "Playwright:" or "ESLint:") and
  the eval keeps the failed spec in `.aiqa/agents/rejected/` for review.

- **Generated specs are now type-checked before they run.** With the error now in the log, qwen3's
  generator failure was plain: it called `inventoryPage.sortCombobox`, `sortOption()` and
  `addToCartFirstProduct()`, none of which exist, and the run failed with a TypeError. The check now
  runs `tsc` between lint and the test run, so the model gets "Property 'sortCombobox' does not exist
  on type 'InventoryPage'" with the line; and the inventory page object is one of its examples.

Not done yet:

- **qwen3:8b still fails the generator eval.** After the type check its spec uses only real
  page-object members (`sort`, `prices()`, `card(...).addToCart`) but skips the sign-in the seed spec
  shows, so the first click times out on the login page. `qwen2.5-coder:7b` passes on the first
  attempt (3.0 min, down from 9.0). For writing specs, keep `qwen2.5-coder:7b` or use a hosted model.
- **Playwright's agents against ours** ([agents-vs-playwright.md](agents-vs-playwright.md)):
  Playwright's planner passes (23 scenarios, 44 steps, every named element on the page) and its
  generator's spec passes 3 runs in a row; ours pass the plan and the healing gate, and the spec on
  `qwen2.5-coder:7b` only. Its healer is still to run. Scoring its plan showed our plan parser did not
  read Playwright's layout (it read 0 steps); `parsePlan` now reads both.
- **The nightly cluster workflow's first run failed at the load step** with "attempt to write a
  readonly database". The Jobs write `.aiqa` (run history included) as root through the kind
  mount; the load step then records k6's summary on the runner as its own user, which cannot write to
  that file. Docker Desktop on Windows does not enforce file owners, so the laptop never showed it.
  The workflow now hands `.aiqa` back to the runner (`chown`) before recording; the next run checks it.

## Review after Phase 5 (23 Nov)

A pass over the whole repository once Phase 5 was done, for anything stale, inconsistent or loose.

Changed:

- **Lint is clean.** The four `expect-expect` warnings are gone: the custom-matcher test's helper is
  now known to the rule, two feature tests gained the assertion they lacked, and setup projects are
  exempt because they record state rather than assert it. The rule is now an error, so a test
  without an assertion fails lint.
- **Docs caught up with Phase 5.** `docs/architecture.md` has the agents, the MCP server and the web
  app; the ADR index lists 0014 to 0016; the `ai-agents` and `documentation` READMEs no longer say
  "not built yet"; the root README's package rows and agent section match what is built.
- **Eight new interview questions** (51 in all) on agent safety, agent evals, testing a chat on a
  stub model, prompt injection, MCP, component tests, testing a Keycloak sign-in, and starter
  templates. Each points at the files that answer it, which the bank's unit test checks.
- **Patch and minor updates:** `ai` 7.0.179, `@ai-sdk/openai-compatible` 3.0.94, `mongodb` 7.9.1,
  `vitest` 5.1.1, `allure-playwright` 3.15.0, `typescript-eslint` 8.73.0, `lint-staged` 17.6.2.
  The majors held back on purpose (TypeScript 7, `@types/node` 26, pnpm 12) stay held.

Run on the Windows laptop:

| Check                            | Result                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| Typecheck, prettier              | passed                                                        |
| Lint                             | 0 errors, 0 warnings                                          |
| Unit tests                       | 304 passed                                                    |
| Licence gate                     | 857 packages, all allowed (1 named exception)                 |
| Docs site build                  | 36 pages, every internal link resolves                        |
| Changed feature specs (Chromium) | 17 passed, 1 skipped (the `fixme` example, skipped by design) |

`pnpm audit` still reports the same two moderate advisories (see Known gaps); the updates above do
not clear them.

## Sprint 14: docs site, project templates, web app in Kubernetes (23 Nov). Phase 5 complete

Built:

- `apps/documentation`, a Starlight site made from `docs/` (learning path, architecture, ADRs,
  coverage matrix, status). Links between docs become site links, links to code become GitHub links,
  and the build fails on any broken internal link. `.github/workflows/docs.yml` publishes it to
  GitHub Pages; CI builds it on every push.
- `packages/templates` and `aiqa new project <name> --kind ui|api|both`: a standalone Playwright
  project (page objects, fixtures, smoke tests on SauceDemo, a read-only API suite on Restful-Booker)
  pinned to this repository's Playwright and TypeScript. CI generates each kind and runs its tests.
- `aiqa heal-review` always writes `.patch` and `.md` files to `.aiqa/heal-patches`; with
  `--apply --branch` it commits the accepted fixes on a new `heal/<date>` branch. Nothing is pushed
  and no token is needed.
- The Helm chart now runs Keycloak (realm loaded from the repository's file) and the web app
  (`apps/web/Dockerfile`, Next.js standalone, port 3200 as user `node`). The web app reaches
  Keycloak by its in-cluster name while the browser uses `localhost:30180`.

Run on the Windows laptop:

| Check                         | Result                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Typecheck, lint, prettier     | passed; 0 lint errors (the 4 old `expect-expect` warnings)                            |
| Unit tests                    | 304 passed (heal patches and branch, templates, docs sync, the issuer rewrite)        |
| Licence gate                  | 857 packages, all allowed (1 named exception)                                         |
| Docs site build (`DOCS_BASE`) | 36 pages, search index built, every internal link resolves                            |
| Generated projects            | ui 3 passed, api 3 passed, both 6 passed, each after `npm install` and `tsc --noEmit` |
| Helm                          | `helm lint` 0 failed; `helm template` renders Keycloak and the web app                |
| Web app image                 | `aiqa/web` built, 367 MB                                                              |
| Web app (`pnpm test:web`)     | 40 passed against the recreated Keycloak                                              |

The gate passes: the docs site builds with every link resolving, and each generated project passes
its own tests.

Fixed on the way:

- The generated UI tests found nothing on SauceDemo: its elements use `data-test`, not Playwright's
  default `data-testid`. The template now sets `testIdAttribute`, and a unit test checks it.
- A failed local run of a generated project stopped to serve the HTML report; the template now
  never opens it.
- Doc folder links went to GitHub instead of the site page; the site had no favicon (found by the
  link check).

Not done: the cluster has not been recreated with the new chart (`pnpm k8s:down && pnpm k8s:up`,
since kind opens its ports only when the cluster is created). The docs site is live at
https://logeshlodi.github.io/AI-QA-Platform/ (published by the docs workflow since 23 Nov).

## Sprint 13: chat and admin, and tests for AI features (22 Nov)

Built: `/chat` in the web app, answering from the platform MCP server's tools (connected in process),
streamed; `quarantine_test` as the one write, held as an approval card with a sealed ten-minute token
and carried out only by `/api/chat/approve` for a `platform-admin`; `/admin` with the model in use (key
never shown), the chat's step and time budget, a switch for chat writes, and the quarantine list. Realm:
`platform-admin` role and `qa-admin` user. ADR 0016 and learning stop 15.

Run on the Windows laptop:

| Check                         | Result                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Typecheck, prettier, licences | passed; 647 packages, all allowed                                                                                |
| Lint                          | 0 errors (the 4 old `expect-expect` warnings)                                                                    |
| Unit tests                    | 289 passed (24 in the web app: request limits, tool-output wrapping, settings, quarantine store, the stub model) |
| Component tests               | 53 passed: chat transcript and composer added, axe on all 27 stories                                             |
| Visual baselines              | 27 in the Playwright Linux image (8 new for the chat)                                                            |
| Web app (`pnpm test:web`)     | 40 passed against the real Keycloak and the stub model                                                           |

The gate passes: an instruction planted in a page's text (a storefront failure telling the model to
quarantine `checkout-two`) makes the stub model, scripted to obey, ask for the write; nothing is written
until a person decides, a viewer cannot approve in the page or through the API with the token, and an
admin is asked first too. The chat specs also cover streaming and Stop, the same question answered in
different words with the same facts, and the API refusing no session, another origin, non-JSON and
oversized requests.

Fixed on the way:

- The proxy redirected a signed-out API call to the sign-in page (200, HTML); API routes now bypass it
  and answer 401 themselves.
- A new Playwright request context inherits the project's signed-in state; the "no session" check now
  passes an empty one.
- `role="alert"` on a list item replaced its list role (axe `list`); the Approve button's white on the
  chart blue was just under 4.5:1, so buttons use the link blue.
- Prettier read the saved sign-in state (`playwright/.auth`); it is ignored now. axe needed more than
  30 s on the first stories with four workers on a busy laptop.

Not done: trying the chat on the real local model is manual (`AI_ENABLED=true pnpm web`, sign in as
`qa-admin`); with `qwen2.5-coder:7b` on CPU expect minutes per answer.

## Sprint 12: web dashboard, Keycloak sign-in, component tests (22 Nov)

Built: `apps/web` (Next.js 16, React 19) with overview, runs, a run's tests, trends, flaky tests, heal
audit and agent runs, read-only over the existing stores; sign-in through the stack's Keycloak (new
`web` client, code flow with PKCE, encrypted cookie session, `dashboard-viewer` role checked on every
page); `packages/dashboard` with the shared components and a story per state; ADR 0015 and learning
stop 14.

Run on the Windows laptop:

| Check                                    | Result                                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck (root, dashboard, web)         | passed                                                                                                                                                               |
| Lint                                     | 0 errors (the 4 old `expect-expect` warnings in feature specs)                                                                                                       |
| Unit tests                               | 277 passed (12 new: session cookie, return address, roles)                                                                                                           |
| Prettier, licence gate                   | passed; 647 packages, all allowed                                                                                                                                    |
| Component tests (`pnpm test:components`) | 38 passed: behaviour, keyboard, axe on all 19 stories light and dark                                                                                                 |
| Visual baselines                         | 19 made in the Playwright Linux image (`dashboard-snapshots`)                                                                                                        |
| Web app (`pnpm test:web`)                | 24 passed against the real Keycloak: sign-in and out, no-role page, open redirect, changed cookie, expired sign-in, headers, every page's numbers, axe on every page |

The gate (end-to-end, component, accessibility and visual specs) passes locally; the visual
comparison and both new jobs run in CI on the next push.

Fixed on the way:

- The web app first used port 3000, which the stack's Grafana already serves, and Grafana also
  answers `/healthz`: Playwright reused it and tested Grafana. The app is on 3200 now, and its
  Playwright config never reuses a running server, so a clash fails loudly.
- Next.js pulls in `sharp`, whose libvips binaries are LGPL-3.0 and failed the licence gate. The app
  has no images to optimise: `sharp` is not installed (`ignoredOptionalDependencies`) and images are
  unoptimised.
- Keycloak serves its login form again from `login-actions/authenticate` after a wrong password;
  Next.js keeps an empty `role=alert` route announcer on every page; axe needed more than 30 s on the
  first pages with four workers on a busy laptop. Specs adjusted for each.
- The realm only imports into a fresh Keycloak container: after the realm file changes, run
  `docker compose -f infrastructure/docker/stack.compose.yml up -d --force-recreate keycloak`.

Not done: the three placeholder folders (`apps/web-dashboard`, `apps/ai-chat`, `apps/admin`) are
removed in the commit (decision 3: one app with three areas).

## Sprint 11: five more agents and live evals for all nine (20 to 22 Nov)

Run on the Windows laptop, `qwen2.5-coder:7b` on CPU through Ollama (`AI_ENABLED=true pnpm aiqa agents eval <agent> --record`).

| Agent          | What the eval measures                                                    | Score        | Gate        | Time     |
| -------------- | ------------------------------------------------------------------------- | ------------ | ----------- | -------- |
| Triage         | 30 recorded failures labelled product, test, flaky or environment         | 28/30 (93%)  | 80%, passed | 9.7 min  |
| Flaky hunter   | Likely cause of 8 flaky tests from their errors                           | 8/8 (100%)   | 75%, passed | 10.3 min |
| Accessibility  | Priority of 10 axe findings by what users cannot do                       | 9/10 (90%)   | 80%, passed | 10.1 min |
| Run reporter   | 5 summaries with every number in the facts and every failure named        | 4/5 (80%)    | 80%, passed | 4.8 min  |
| Test data      | Model-proposed edge-case records that pass their schema                   | 8/8 (100%)   | 80%, passed | 5.7 min  |
| Healing review | Pull-request descriptions that name the locator and its new form          | 3/3 (100%)   | 80%, passed | 2.3 min  |
| Planner        | Plans for 2 SauceDemo pages that name only elements on the page           | 2/2 (100%)   | 80%, passed | 5.3 min  |
| Generator      | Scenario 1 of the inventory plan passes 3 runs in a row                   | 1/1          | passed      | 9.0 min  |
| API tester     | Model-proposed cases the OpenAPI document allows, every operation covered | 11/11 (100%) | 80%, passed | 35.8 min |

The misses: Triage as in Sprint 9; Accessibility ranked `link-name` fix-soon where the label says
fix-now; Run reporter's "site down" summary was rejected and replaced by the template. The API tester
first timed out twice at 15 minutes (0/4) and then scored 7/11 before the fixes below; after them it
scored 11/11.

Fixed on the way:

- `--record` opened the run history read-only and could not save; it now uses the reporter's writable
  store. Planner and Generator scores are recorded (suite `agents`); the others' are in
  `.aiqa/agents/eval-*.log`.
- The API tester asked for every operation's cases in one answer, which a CPU model could not
  finish in 15 minutes. It now asks once per operation for two or three cases, and `body` is required
  in the answer for operations that take one (left optional, the model sent PUTs without a body).
- Saving the API tester's scores failed because two model cases shared a name and the run history
  keys results by test id; ids now carry the operation and a counter for repeats. Its 11/11 is in
  `.aiqa/s11b/eval-api-tester.log`, not yet in the run history.
- Starting the stack on a busy laptop failed three ways, each fixed in `stack.compose.yml`: Keycloak
  gets a 300 s start period, Kafka's health check 30 s and a 180 s start period, and the order service
  `restart: on-failure:5` when it cannot join its consumer group right after Kafka turns healthy.
- The kind cluster was stopped to free about three CPU cores; `docker start aiqa-control-plane` brings
  it back unchanged.

## Sprint 10: Planner, Generator and Healing review agents (20 Nov)

Run on the Windows laptop, `qwen2.5-coder:7b` on CPU through Ollama, against SauceDemo.

| Check                                                                          | Result                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Healing review, end to end (`pnpm test:ui tests/healing`)                      | 10 passed, 1 skipped (the model tie-break, AI off). New: a real heal event becomes a page-object patch, the patch applies, and the patched page object clicks the button on the changed page. **Gate, second half: passed** |
| Planner (`aiqa agents plan inventory --path /inventory.html --logged-in`)      | `specs/inventory.plan.md`, 3 scenarios, 9 min 36 s. Scenarios 1 and 2 are sound; scenario 3 is labelled negative but is not one                                                                                             |
| Generator, first run                                                           | Failed both attempts on the same two mistakes: the fixtures import one folder too shallow, and quote marks inside step titles. Moved out of `tests/` as designed                                                            |
| Generator, after adding `repairSpec` (plain-code fixes for those two mistakes) | `tests/generated/main-happy-path.spec.ts` lint-clean and **passed 3 runs in a row on the first attempt**, 6 min 16 s. **Gate, first half: passed**                                                                          |
| Unit tests                                                                     | All pass (33 in `ai-agents`, 42 in `self-healing-engine`, among them the heal-store migration and patch rules)                                                                                                              |
| Type-check, lint, Prettier                                                     | Clean; lint 0 errors, the same 4 warnings                                                                                                                                                                                   |

Review note on the generated spec: its second step says "add the first product" but adds the backpack,
which is not first after sorting by price. The assertion still holds; a reviewer should rename the step
or change the product. Playwright's own planner, generator and healer were not run: they need Claude
Code and your go-ahead (see `docs/learning/11-test-agents.md`).

## Sprint 9: agent runtime, Triage agent, MCP server (20 Nov)

Run on the Windows laptop, local model `qwen2.5-coder:7b` on CPU through Ollama.

| Check                                                              | Result                                                                                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (`pnpm test:unit`)                                      | 227 passed (27 new: runtime budget, approval, tool errors, schema failure, model choice, run log, triage rules and context, the MCP server through an in-memory client) |
| Triage eval, rules then model (`AI_ENABLED=true pnpm agents:eval`) | **28 of 30 (93%), gate 80% passed**, 8 min 45 s. Rules placed 23 of 23 correctly; the model placed 5 of 7, about 150 s each, without calling a tool                     |
| Triage eval, rules only (`pnpm aiqa agents eval triage`)           | 23 of 30 (77%): every rule answer right, 7 left as "unknown"                                                                                                            |
| MCP server over stdio (`pnpm mcp:smoke`)                           | 7 tools listed; `list_runs`, `make_test_data` and `triage_failures` answered from the laptop's run history, started with the same command `.mcp.json` gives Claude Code |
| Type-check, lint, Prettier                                         | Clean; lint 0 errors, the same 4 warnings                                                                                                                               |

The model's two misses: it called "target page closed" (a missing `await` in the test) an environment
problem, and an HTML page returned instead of JSON a test bug. Both are in `src/triage/cases.ts`.

Open: the 30 eval labels are mine; review them, since the gate is meant to match your judgement. Not
yet checked from inside Claude Code itself, and not yet measured with `qwen3:8b` or a hosted model.

## Learning sprint (20 Nov)

Run on the Windows laptop.

| Check                                          | Result                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Lab solutions (`pnpm test:labs`)               | 13 passed (labs 01 to 07 against the public practice sites, lab 08 on local keys)                                            |
| Lab exercises (`pnpm lab 01` to `pnpm lab 08`) | Each failed for the reason its README gives; lab 08 failed exactly its three attack cases (tampered, `alg: none`, wrong key) |
| Question bank and quiz (`pnpm test:unit`)      | 200 passed (11 new): every path an answer cites exists, every lab it names exists, seeded selection repeats                  |
| `pnpm aiqa quiz --coverage`                    | 43 questions, at least three on each of the 11 topics                                                                        |
| Type-check, lint, Prettier                     | Clean; lint still 0 errors and the same 4 warnings                                                                           |

One lab changed after it ran. Lab 04 was written as "the test that cannot fail", but Playwright 1.65
fails an unawaited assertion with "Test ended". The lab now teaches reading that message, and why an
unawaited assertion inside a helper can still pass.

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
  which passes) and the comparison with ours is ready (`docs/agents-vs-playwright.md`,
  `pnpm aiqa agents compare`). Our side has run; theirs needs a person in Claude Code.
- **Firefox and WebKit run journeys and smoke only**; the labs run on Chromium by design.
- **The nightly cluster workflow** (`.github/workflows/kubernetes.yml`) has run once and failed at the
  load step (file ownership, fixed above); the fix is unproven until its next run.

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
- **k6's live percentiles in Grafana are estimates.** Over OpenTelemetry a trend arrives as a histogram
  with fixed buckets, so a p95 is placed within its bucket (49.7 ms in Grafana against k6's exact 46 ms
  in one smoke run). The run history records k6's exact summary.
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
