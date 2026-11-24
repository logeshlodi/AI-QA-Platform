# Mobile testing plan

Date: 24 Nov 2026. Status: agreed, Sprint M1 in progress.

The platform tests web apps, APIs, data stores and load. This plan adds native mobile apps, with
the same habits as the rest of the repository: the Playwright Test runner, fixtures for everything
a test needs, screen objects, run history, the agents, and CI on all three pipelines. Nothing in
the existing packages changes; mobile is a new package, `packages/mobile-framework`.

## Decisions

| Decision      | Choice                                                                              | Why                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automation    | Appium 4.0.1 with the UiAutomator2 driver 10.0.0                                    | The open-source standard for native apps. Playwright drives browsers, not native views. Appium 4 went stable on 15 Nov; UiAutomator2 moved to it from version 9, so staying on Appium 3 would freeze the driver at 8.7.3.                                                              |
| Client        | WebdriverIO 10.2.0, standalone (`remote()`), inside Playwright Test fixtures        | One runner, one report, one history for every suite. WebdriverIO's own runner is not used.                                                                                                                                                                                             |
| Compatibility | Checked before choosing                                                             | WebdriverIO 10 names Appium 3 as its minimum. A session against Appium 4.0.1 (with Appium's fake driver) passed: find by accessibility ID, strict `$`, alerts, contexts and W3C touch actions. If a real-device problem appears, the fallback is Appium 3.9.1 with UiAutomator2 8.7.3. |
| Drivers       | Pinned in `package.json`; Appium finds them through `APPIUM_HOME`                   | No `appium driver install`, no global install: `pnpm install` gives every machine the same server and driver.                                                                                                                                                                          |
| Device        | Android emulator on the laptop (API 34, Google APIs, x86_64)                        | Free, scriptable, and the laptop's hardware acceleration (WHPX) works. A USB phone also works with the same specs.                                                                                                                                                                     |
| Apps          | WebdriverIO's native demo app 2.2.0 (MIT) and Appium's ApiDemos 6.0.18 (Apache-2.0) | Built to be tested, with stable accessibility IDs. Downloaded at a pinned version and checked by SHA-256; never committed.                                                                                                                                                             |
| iOS           | Capabilities and screen objects ready; not run                                      | XCUITest needs macOS and Xcode. There is no Mac. A GitHub macOS runner can run it later.                                                                                                                                                                                               |

## What it covers: every kind of mobile interaction a QA tests

| Area                  | Interactions                                                                                                                        | App          | Sprint |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| Finding elements      | Accessibility ID, resource ID, UiSelector, text; strict matching; why XPath is the last resort                                      | Demo app     | M1     |
| Taps and text         | Tap, type, clear, hide the keyboard, secure text fields, validation messages                                                        | Demo app     | M1     |
| Controls              | Switch, dropdown (native picker), enabled and disabled buttons                                                                      | Demo app     | M1     |
| Dialogs               | System alerts with one and three buttons, reading the title and message                                                             | Demo app     | M1     |
| Gestures              | Horizontal swipe (carousel), vertical scroll until an element appears, drag and drop (puzzle)                                       | Demo app     | M1     |
| Navigation            | Bottom tab bar, side menu, Android back                                                                                             | Demo app     | M1     |
| App lifecycle         | Launch, terminate, relaunch, background and foreground, clean state between tests                                                   | Demo app     | M1     |
| Evidence              | Screenshot, page source and device log on failure; screen recording of each test; Appium server log                                 | All          | M1     |
| Long press, menus     | Long press, context menus, popup menus                                                                                              | ApiDemos     | M2     |
| Native widgets        | Check boxes, radio buttons, spinners, seek bar (slider), date and time pickers, rating bar, expandable lists, tabs                  | ApiDemos     | M2     |
| Scrolling             | `UiScrollable` to off-screen list items, fling, pull back                                                                           | ApiDemos     | M2     |
| Toasts, notifications | Read a toast, open the notification shade, act on a notification                                                                    | ApiDemos     | M2     |
| Device state          | Orientation, locale, clipboard, geolocation, network on and off, airplane mode, battery                                             | Both         | M2     |
| Permissions           | Grant and revoke at runtime, the system permission dialog                                                                           | Demo app     | M2     |
| Deep links, intents   | Open a screen by deep link and by activity, app switching                                                                           | Both         | M2     |
| Storage               | Data kept across a restart, cleared by "clear data"                                                                                 | Demo app     | M2     |
| Hybrid apps           | Switch to the WebView context, test the web content, switch back                                                                    | Demo app     | M2     |
| Pinch and zoom        | Two-finger gestures                                                                                                                 | ApiDemos     | M2     |
| Install and upgrade   | Install, uninstall, reinstall over an older build, launch after upgrade                                                             | Both         | M2     |
| Visual                | Screen comparison with masks for the status bar and clock                                                                           | Demo app     | M3     |
| Accessibility         | Every tappable element has a label and a 48 dp target, from the page source                                                         | Both         | M3     |
| Performance           | Cold start time, memory and CPU while a screen is used                                                                              | Demo app     | M3     |
| Mobile web            | Chrome on the emulator (Appium with Chromedriver), and Playwright's experimental Android API for comparison                         | A local page | M3     |
| Platform integration  | Run history and dashboard, triage, flaky hunter, `aiqa select`, review rules for mobile specs, locator healing for screen objects   | All          | M3     |
| CI                    | Jenkins and Azure DevOps on the laptop's emulator; GitHub Actions on a Linux runner's emulator; the fake-driver suite on every push | All          | M3     |

## Sprints

**M1. Foundation (now).** `packages/mobile-framework`: Appium server per worker, a WebdriverIO
session fixture, device and app config, screen objects for the demo app, gestures, evidence on
failure. Specs for login, sign-up, forms, alerts, swipe, scroll, drag and drop, navigation and
app lifecycle. A suite against Appium's fake driver that runs anywhere, plus unit tests.
`pnpm mobile:doctor` checks the machine; `pnpm mobile:apps` downloads the two apps.
Gate: the demo-app suite passes twice in a row on the emulator; the fake-driver suite passes in
the Linux workspace and on the laptop.

**M2. Native depth.** ApiDemos screens, device state, permissions, deep links, hybrid WebView,
install and upgrade. Gate: every M2 row in the table has a passing spec.

**M3. Platform and CI.** Visual, accessibility and performance checks, mobile web, the agents and
dashboard, the three pipelines. Gate: one pipeline run on each CI system, recorded in the history.

## The laptop

Checked on 24 Nov (read-only): i7-1185G7, 32 GB, Windows 11, Node 24, JDK 26, Android Studio with
SDK platform 34 and build tools 34, emulator 37.3, WHPX acceleration "installed and usable".

Missing, and yours to install in Android Studio (they download Google packages and need its
licences accepted):

1. **SDK Manager → SDK Tools:** "Android SDK Command-line Tools (latest)".
2. **SDK Manager → SDK Platforms:** tick "Show Package Details", then under Android 14 (API 34)
   "Google APIs Intel x86_64 Atom System Image" (Google APIs, not Google Play, so the tests can use
   `adb root`).
3. **Device Manager → Create virtual device:** Pixel 7, the API 34 Google APIs image, named
   `aiqa_api34`.

The scripts find the SDK and JDK themselves and set `ANDROID_HOME` and `JAVA_HOME` only for the
processes they start; no system settings change.

Memory: the emulator needs about 4 GB. With Docker and the kind cluster running the laptop had 4 GB
free, so mobile runs take the CI lock and work best with the cluster stopped.

## What is left out

- **iOS runs**, until there is a Mac (see above).
- **Cloud device farms** (BrowserStack, Sauce Labs): paid. The capabilities are plain W3C, so
  pointing the session at a farm is a configuration change.
- **Espresso and Flutter drivers**: the two apps are React Native and classic Android views, which
  UiAutomator2 covers.
- **Payments**: not in scope for now.
