# @aiqa/mobile-framework

Native Android apps through Appium 4 and the UiAutomator2 driver, driven by WebdriverIO 10's
standalone client and run by Playwright Test: the same runner, report, retries and run history as
every other suite. The plan and the reasons for each choice are in
[docs/mobile-plan.md](../../docs/mobile-plan.md).

## Run it

```
npx pnpm mobile doctor          # what an Android run needs, and what is missing (changes nothing)
npx pnpm mobile apps            # downloads the two pinned apps, checks their SHA-256
npx pnpm test:mobile            # the demo-app suite on the emulator (Appium boots it)
npx pnpm test:mobile:fake       # the framework itself, against Appium's fake driver: no device needed
```

The first Android run boots the emulator and installs the UiAutomator2 helper apps, which takes a
minute or two; after that a test is seconds. Tests run one at a time on the one device.

| Variable                   | Default             | What it does                                                  |
| -------------------------- | ------------------- | ------------------------------------------------------------- |
| `AIQA_AVD`                 | `aiqa_api34`        | The emulator Appium boots when no device is attached          |
| `AIQA_ANDROID_UDID`        | (unset)             | Use this device from `adb devices` instead (a USB phone, say) |
| `AIQA_APPS_DIR`            | `.aiqa/mobile/apps` | Where the downloaded apps are kept                            |
| `AIQA_MOBILE_VIDEO`        | (unset)             | `on` attaches the screen recording to passing tests too       |
| `AIQA_AVD_BOOT_TIMEOUT_MS` | `180000`            | How long the emulator may take to boot                        |

The SDK and the JDK are found on their own (Android Studio's locations, `ANDROID_HOME`,
`JAVA_HOME`, `java` on `PATH`); the scripts set them for the processes they start only.

## How it fits together

| File                          | What it does                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/appium-server.ts`        | Starts Appium per worker on a free port, with `APPIUM_HOME` set to this package so the drivers in its `package.json` are the ones it loads |
| `src/fixtures.ts`             | `driver` (one session per worker), `app` (relaunched before every test), `screens`, and automatic evidence                                 |
| `src/capabilities.ts`         | The W3C capabilities, with the reason for each setting                                                                                     |
| `src/screens/`                | Screen objects: accessibility IDs first, Android resource IDs for system views, XPath never without a reason                               |
| `src/evidence.ts`             | On failure: screenshot, UI tree, logcat, the Appium log for that test, and the screen recording                                            |
| `src/apps.ts`                 | The pinned apps: version, licence, URL and SHA-256                                                                                         |
| `src/doctor.ts`, `src/cli.ts` | The readiness check (also the `device` setup project) and `pnpm mobile`                                                                    |

| Folder          | What it checks                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `tests/android` | The demo app: navigation, sign-in and sign-up, form controls, system alerts, swipe, scroll, drag and drop, the app lifecycle |
| `tests/fake`    | The framework on Appium's fake driver: server, session, strict locators, alerts, contexts, gestures, evidence                |
| `tests/unit`    | SDK discovery, `adb devices` parsing, the app manifest and downloads, capabilities, the doctor report (Vitest)               |

Patterns worth reading: `$` in WebdriverIO 10 throws when a selector matches two elements, so an
ambiguous locator fails loudly instead of tapping the wrong thing; screen objects read state and
specs assert with `expect.poll`, the mobile version of a web-first assertion; the carousel's current
card is found by geometry, because its neighbours are also in the UI tree.
