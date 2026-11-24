import type { Browser } from 'webdriverio';
import { shellQuote } from './screens/apidemos';

/**
 * What the device's network really does, read from Android itself (the server's `adb_shell`
 * feature). Appium's `mobile: getConnectivity` reads the saved settings instead: in airplane mode it
 * still says Wi-Fi and data are on (Android keeps `wifi_on` as 3, "on, but airplane mode"), while
 * the radios are off and nothing can be reached.
 */

async function shell(driver: Browser, command: string, args: string[]): Promise<string> {
  return String(
    await driver
      .execute('mobile: shell', { command, args, timeout: 20_000 })
      .catch((error: unknown) => (error instanceof Error ? error.message : String(error))),
  );
}

/**
 * Whether a public address answers a ping: the device can reach the internet. Run through `sh` so
 * an unreachable network is an answer (the exit code), not an error in the logs.
 */
export async function canReachInternet(driver: Browser, host = '8.8.8.8'): Promise<boolean> {
  const code = await shell(driver, 'sh', [
    '-c',
    shellQuote(`ping -c 1 -W 2 ${host} >/dev/null 2>&1; echo $?`),
  ]);
  return code.trim() === '0';
}

/** Whether the Wi-Fi radio is on (`cmd wifi status`), whatever the settings say. */
export async function wifiRadioOn(driver: Browser): Promise<boolean> {
  return /Wifi is enabled/.test(await shell(driver, 'cmd', ['wifi', 'status']));
}
