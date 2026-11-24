import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import { loadEnv } from '@aiqa/shared';
import { remote, type Browser } from 'webdriverio';
import { AppiumServer } from './appium-server';
import { APPS, appPath, type AppName, type AppSpec } from './apps';
import { androidCapabilities, fakeCapabilities } from './capabilities';
import { mobileConfig } from './config';
import { attachEvidence } from './evidence';
import { createScreenHealer } from './healing';
import { apiDemos, type ApiDemos } from './screens/apidemos';
import { demoApp, type DemoApp } from './screens/demo-app';

export type Platform = 'android' | 'fake';

/** Android's answer to queryAppState. */
export const APP_STATE = { notInstalled: 0, notRunning: 1, background: 3, foreground: 4 } as const;

export interface AppControl {
  spec: AppSpec;
  /** Stops the app and starts it again from its launch screen. */
  relaunch(): Promise<void>;
  /** Sends the app to the background for a while, as pressing Home would, then brings it back. */
  background(seconds: number): Promise<void>;
  terminate(): Promise<void>;
  activate(): Promise<void>;
  state(): Promise<number>;
  /** Opens one of the app's activities directly (`.view.Controls1`), as a launcher shortcut would. */
  open(activity: string): Promise<void>;
  /** Wipes the app's data and runtime permissions (Android's "Clear storage"), then starts it. */
  reset(): Promise<void>;
  /** Opens a deep link in this app (`wdio://forms`), the way a link in an email or a browser would. */
  deepLink(url: string): Promise<void>;
  /** The activity in front, as Android names it (`.view.Controls1`). */
  activity(): Promise<string>;
  /**
   * Sets the app's own language (Android 13's per-app language, `fr-FR`), as Settings > Apps >
   * Language would; `undefined` goes back to the system language. Android restarts the app.
   */
  setLanguage(locale: string | undefined): Promise<void>;
}

interface WorkerOptions {
  /** Set per project: a real Android device or emulator, or Appium's fake driver. */
  platform: Platform;
  /** The app the worker's session installs. */
  appName: AppName;
}

interface WorkerFixtures {
  appium: AppiumServer;
  /** One session per worker: creating one installs the UiAutomator2 server and takes seconds. */
  driver: Browser;
}

interface TestFixtures {
  /** The app, relaunched before every test so each one starts from the same screen. */
  app: AppControl;
  /** The demo app's screen objects. */
  screens: DemoApp;
  /** ApiDemos' screen objects (the android-apidemos project). */
  api: ApiDemos;
  /** Screen recording, and on failure a screenshot, the UI tree and the logs (automatic). */
  evidence: void;
}

const config = mobileConfig();

export const test = base.extend<TestFixtures, WorkerOptions & WorkerFixtures>({
  platform: ['android', { scope: 'worker', option: true }],
  appName: ['demo', { scope: 'worker', option: true }],

  appium: [
    async ({}, use, workerInfo) => {
      const server = await AppiumServer.start({
        logFile: path.join(workerInfo.project.outputDir, `appium-worker-${workerInfo.workerIndex}.log`),
        // `mobile: shell` (adb shell) is off by default because it runs any command on the device.
        // Enabled for this server only: it listens on 127.0.0.1, is started and stopped by the tests,
        // and the specs use it to post a notification (the shade tests).
        allowInsecure: ['uiautomator2:adb_shell'],
      });
      await use(server);
      await server.stop();
    },
    { scope: 'worker', timeout: 200_000 },
  ],

  driver: [
    async ({ appium, platform, appName }, use) => {
      const capabilities =
        platform === 'fake'
          ? fakeCapabilities()
          : androidCapabilities(APPS[appName], await appPath(APPS[appName], config.appsDir), config);
      const driver = await remote({
        hostname: '127.0.0.1',
        port: appium.port,
        path: '/',
        logLevel: 'warn',
        // The first session may boot the emulator and install the UiAutomator2 server.
        connectionRetryTimeout: config.bootTimeoutMs + 120_000,
        connectionRetryCount: 0,
        capabilities: capabilities as WebdriverIO.Capabilities,
      });
      await use(driver);
      await driver.deleteSession();
    },
    { scope: 'worker', timeout: config.bootTimeoutMs + 180_000 },
  ],

  app: [
    async ({ driver, platform, appName }, use) => {
      const spec = APPS[appName];
      const id = spec.appPackage;
      const control: AppControl = {
        spec,
        terminate: async () => void (await stopApp(driver, id)),
        activate: async () => void (await driver.activateApp(id)),
        state: async () => Number(await driver.queryAppState(id)),
        relaunch: async () => {
          // A stray swipe from the top edge opens the notification shade, which stays over the app
          // and hides it from every later test. Close it first (Android's `cmd statusbar collapse`).
          await driver.execute('mobile: statusBar', { command: 'collapse' }).catch(() => undefined);
          await stopApp(driver, id);
          await driver.activateApp(id);
        },
        background: async (seconds) => void (await driver.background(seconds)),
        open: async (activity) => {
          await driver.execute('mobile: startActivity', { intent: `${id}/${activity}`, wait: true });
        },
        reset: async () => {
          await driver.execute('mobile: clearApp', { appId: id });
          // Right after "Clear storage" a start request is sometimes ignored while Android finishes
          // clearing; ask again until the app is actually in front.
          await driver.waitUntil(
            async () => {
              await driver.activateApp(id);
              return Number(await driver.queryAppState(id)) === APP_STATE.foreground;
            },
            { timeout: 20_000, interval: 2_000, timeoutMsg: `${id} did not start after Clear storage` },
          );
        },
        deepLink: async (url) => {
          await driver.execute('mobile: deepLink', { url, package: id });
        },
        activity: async () => driver.getCurrentActivity(),
        setLanguage: async (locale) => {
          await driver.execute('mobile: shell', {
            command: 'cmd',
            args: ['locale', 'set-app-locales', id, '--locales', locale ?? "''"],
          });
        },
      };
      if (platform === 'android') await control.relaunch();
      await use(control);
    },
    { auto: true },
  ],

  screens: async ({ driver, app, platform }, use, testInfo) => {
    // Named locators heal through the same engine as the web framework (HEAL_MODE, HEAL_THRESHOLD).
    const env = loadEnv();
    const { healer, close } = createScreenHealer(driver, testInfo, env.HEAL_MODE, env.HEAL_THRESHOLD);
    const screens = demoApp(driver, platform === 'android' ? healer : undefined);
    if (platform === 'android' && app.spec.name === 'demo') await screens.home.waitUntilShown(30_000);
    await use(screens);
    close();
  },

  api: async ({ driver, app, platform }, use) => {
    const screens = apiDemos(driver);
    if (platform === 'android' && app.spec.name === 'apidemos') await screens.home.waitUntilShown(30_000);
    await use(screens);
  },

  evidence: [
    async ({ driver, appium, platform }, use, testInfo) => {
      const mark = appium.mark();
      const recording = platform === 'android' && (await startRecording(driver));
      await use();
      const failed = testInfo.status !== testInfo.expectedStatus;
      const video = recording ? await driver.stopRecordingScreen().catch(() => undefined) : undefined;
      if (failed) {
        await attachEvidence(testInfo, { driver, serverLog: () => appium.since(mark), video });
      } else if (video && config.videoAlways) {
        await testInfo.attach('screen.mp4', { body: Buffer.from(video, 'base64'), contentType: 'video/mp4' });
      }
    },
    { auto: true },
  ],
});

/**
 * Stops the app. Appium's default wait is 500 ms, and on the emulator the app sometimes took longer
 * (seen after the puzzle's confetti), which failed the next test before it started.
 */
async function stopApp(driver: Browser, appId: string): Promise<void> {
  await driver.execute('mobile: terminateApp', { appId, timeout: 5_000 });
}

/** Recording is best effort: an emulator without screenrecord support still runs the test. */
async function startRecording(driver: Browser): Promise<boolean> {
  try {
    await driver.startRecordingScreen({ timeLimit: '180', videoSize: '720x1280', bitRate: '2000000' });
    return true;
  } catch {
    return false;
  }
}

export { expect };
