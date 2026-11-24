import path from 'node:path';
import type { AppSpec } from './apps';
import { PACKAGE_DIR, type MobileConfig } from './config';

/** W3C capabilities: plain keys for the standard ones, `appium:` for everything Appium adds. */
export type Capabilities = Record<string, string | number | boolean | undefined>;

/**
 * An Android session on UiAutomator2. If no device is attached, Appium boots the configured
 * emulator itself (`appium:avd`). Choices that make runs steadier are explained inline.
 */
export function androidCapabilities(app: AppSpec, apk: string, config: MobileConfig): Capabilities {
  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:app': apk,
    'appium:appPackage': app.appPackage,
    'appium:appActivity': app.appActivity,
    // Expo shows a splash activity first; wait for the app's own package, any activity.
    'appium:appWaitActivity': '*',
    ...(config.udid ? { 'appium:udid': config.udid } : { 'appium:avd': config.avd }),
    'appium:avdLaunchTimeout': config.bootTimeoutMs,
    'appium:avdReadyTimeout': config.bootTimeoutMs,
    // Animations make positions move under a tap; switched off for the session, restored after.
    'appium:disableWindowAnimation': true,
    // Permissions are tested on purpose (Sprint M2), not granted behind the tests' back.
    'appium:autoGrantPermissions': false,
    // A session is kept for the whole worker; tests relaunch the app instead of creating sessions.
    'appium:newCommandTimeout': 300,
    'appium:uiautomator2ServerInstallTimeout': 120_000,
    'appium:adbExecTimeout': 60_000,
    // The soft keyboard stays real (UiAutomator2's `hideKeyboard` capability would remove it for
    // the whole session); screens hide it themselves when it covers a button.
  };
}

/** Appium's fake driver: a pretend app described in XML. No device, so it runs anywhere, CI included. */
export function fakeCapabilities(app = path.join(PACKAGE_DIR, 'fixtures', 'fake-app.xml')): Capabilities {
  return {
    platformName: 'Fake',
    'appium:automationName': 'Fake',
    'appium:deviceName': 'Fake',
    'appium:app': app,
  };
}
