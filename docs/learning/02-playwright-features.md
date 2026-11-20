# Playwright features

**You will learn:** how Playwright waits, how to assert without sleeping, how to control the network
and the browser's state, and the runner features that keep a big suite fast and honest. One spec per
feature in `packages/playwright-framework/tests/features/`.

## Waiting and assertions

| Spec                 | The point                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto-wait.spec.ts`  | Actions wait for the element to be visible, stable, enabled and not covered before acting; a real mouse click, which a synthetic DOM click would not be; scrolling a covered field into view  |
| `assertions.spec.ts` | Web-first assertions retry until they pass or time out; `expect.poll` retries a value; `toPass` retries a block; soft assertions collect every failure; a custom matcher with `expect.extend` |

The rule: **never sleep.** `waitForTimeout(2000)` is either too short (flaky) or too long (slow), usually
both on different machines. Wait for the thing you care about instead: `await expect(locator).toHaveText(...)`.
ESLint enforces it here (`playwright/no-wait-for-timeout` is an error).

## Network

| Spec                      | The point                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `network-mocking.spec.ts` | `page.route`: observe a real response, fulfil with made-up data, modify the real response on its way, abort to see how the page copes                                    |
| `har.spec.ts`             | Record a HAR, edit it, replay it with `routeFromHAR`                                                                                                                     |
| `websocket.spec.ts`       | `routeWebSocket` answers the messages a page sends                                                                                                                       |
| `service-workers.spec.ts` | A worker visible on the context, offline from the worker's cache, `context.route` seeing the worker's own requests, and blocking workers so `page.route` sees everything |

Register a route **before** the request happens, usually before `goto`. A route added after the page
has loaded only affects later requests (lab 06).

## State, identity and the browser

| Spec                         | The point                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `auth-storage-state.spec.ts` | Start already logged in from a saved `storageState`; inject a session cookie         |
| `basic-auth.spec.ts`         | HTTP basic auth through `httpCredentials`                                            |
| `browser-state.spec.ts`      | Cookies and local storage, and what survives a reload                                |
| `emulation.spec.ts`          | Geolocation and permissions, locale and timezone, dark mode, offline, a frozen clock |
| `dialogs-and-tabs.spec.ts`   | Alerts, confirms and prompts; right-click; a link that opens a new tab               |
| `files-and-drag.spec.ts`     | Upload a file made in memory, download and save one, drag and drop                   |
| `mouse-and-keyboard.spec.ts` | Hover, key presses, selecting from a dropdown                                        |

The `auth` setup project (`tests/setup/auth.setup.ts`) logs in once and saves the session; the browser
projects depend on it and start from that state. Logging in through the UI in every test is the
commonest reason a suite is slow.

## The runner

| Spec                        | The point                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `execution.spec.ts`         | `test.step`, conditional skip, serial mode, a worker fixture and an option override                                                  |
| `locks-and-shuffle.spec.ts` | Tests that share a lock name never run at the same time; `pnpm test:shuffle` runs in a random order and prints the seed to replay it |

Projects in `playwright.config.ts` run the same specs in Chromium, Firefox, WebKit, two phones, and real
Chrome and Edge. `setup` (target health check) and `auth` run first. CI shards the UI specs three ways
and merges the reports.

## Quality checks that ride along

`quality-checks.spec.ts` (console errors through the `consoleErrors` fixture, broken images, link status
through the API, security headers, SEO tags), `accessibility.spec.ts` (axe-core, WCAG 2.1 A and AA),
`responsive-and-performance.spec.ts` (viewports, navigation timing) and `visual/login.visual.spec.ts`
(`toHaveScreenshot` against a per-platform baseline).

## Common mistakes

| Mistake                                                       | What happens                                        | Lab |
| ------------------------------------------------------------- | --------------------------------------------------- | --- |
| A sleep, then a plain read like `await locator.textContent()` | Fails on a slow day; reads before the page is ready | 01  |
| `expect(...)` without `await`                                 | The assertion never runs before the test ends       | 04  |
| A route registered after `goto`                               | The real response wins; the mock never applies      | 06  |
| One test relying on what another left behind                  | Passes in file order, fails alone or shuffled       | 05  |

## Try it

```bash
npx pnpm test:ui tests/features/assertions.spec.ts
npx pnpm test:shuffle                  # random order; replay a failure with the printed seed
npx pnpm report:html                   # open a trace from the report: every wait is visible in it
```
