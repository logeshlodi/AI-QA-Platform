import type { Browser } from 'webdriverio';

/**
 * Screenshots that compare run to run. The status bar shows the time, the battery and incoming
 * notifications, which change between runs; Android's System UI demo mode (the one Google uses for
 * store screenshots) freezes it: 12:00, full battery and signal, no notification icons. The app's
 * own pixels are untouched.
 *
 * Cropping the bars away would not work for every app: the demo app draws edge to edge, so its
 * content view covers the whole screen, status bar included.
 */

const DEMO = 'com.android.systemui.demo';

async function shell(driver: Browser, command: string, args: string[]): Promise<void> {
  await driver.execute('mobile: shell', { command, args });
}

async function demo(driver: Browser, command: string, extras: string[] = []): Promise<void> {
  await shell(driver, 'am', ['broadcast', '-a', DEMO, '-e', 'command', command, ...extras]);
}

export async function enterDemoMode(driver: Browser): Promise<void> {
  await shell(driver, 'settings', ['put', 'global', 'sysui_demo_allowed', '1']);
  await demo(driver, 'enter');
  await demo(driver, 'clock', ['-e', 'hhmm', '1200']);
  await demo(driver, 'battery', ['-e', 'level', '100', '-e', 'plugged', 'false']);
  await demo(driver, 'network', ['-e', 'wifi', 'show', '-e', 'level', '4']);
  await demo(driver, 'network', ['-e', 'mobile', 'show', '-e', 'datatype', 'none', '-e', 'level', '4']);
  await demo(driver, 'notifications', ['-e', 'visible', 'false']);
}

export async function exitDemoMode(driver: Browser): Promise<void> {
  await demo(driver, 'exit');
}

/** The whole screen as PNG, for `toMatchSnapshot`. Take it in demo mode. */
export async function appScreenshot(driver: Browser): Promise<Buffer> {
  return Buffer.from(await driver.takeScreenshot(), 'base64');
}
