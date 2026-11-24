import os from 'node:os';
import path from 'node:path';

/** The package folder: Appium's home, so the drivers pinned in its package.json are the ones it loads. */
export const PACKAGE_DIR = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(PACKAGE_DIR, '..', '..');

export interface MobileConfig {
  /** The emulator Appium starts when no device is attached (Android Studio's Device Manager name). */
  avd: string;
  /** A specific device from `adb devices` (a USB phone, or `emulator-5554`); Appium picks one if unset. */
  udid?: string;
  /** Where the downloaded apps live. Never committed. */
  appsDir: string;
  /** Where `pnpm mobile chromedriver` keeps the Chromedrivers for the device's Chrome and WebView. */
  chromedriverDir: string;
  /** Attach the screen recording to passing tests as well as failing ones. */
  videoAlways: boolean;
  /** How long Appium may take to boot the emulator, in ms. A cold boot on the laptop is about a minute. */
  bootTimeoutMs: number;
}

/** Settings from the environment, with the laptop's defaults. Every variable is documented in the README. */
export function mobileConfig(env: NodeJS.ProcessEnv = process.env): MobileConfig {
  return {
    avd: env.AIQA_AVD?.trim() || 'aiqa_api34',
    udid: env.AIQA_ANDROID_UDID?.trim() || undefined,
    appsDir: home(env.AIQA_APPS_DIR) || path.join(REPO_ROOT, '.aiqa', 'mobile', 'apps'),
    chromedriverDir:
      home(env.AIQA_CHROMEDRIVER_DIR) || path.join(REPO_ROOT, '.aiqa', 'mobile', 'chromedriver'),
    videoAlways: env.AIQA_MOBILE_VIDEO === 'on',
    bootTimeoutMs: Number(env.AIQA_AVD_BOOT_TIMEOUT_MS ?? 180_000),
  };
}

/** `~/x` is the user's home folder, so CI can name a cache kept between builds the same way on any OS. */
function home(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return v === '~' || v.startsWith('~/') || v.startsWith('~\\') ? path.join(os.homedir(), v.slice(1)) : v;
}
