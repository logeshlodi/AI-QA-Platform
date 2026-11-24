import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { androidEnv, findSdk, sdkTools } from './android-sdk';
import { PACKAGE_DIR, type MobileConfig } from './config';

/**
 * Mobile web: a small page served from this machine and opened in Chrome on the device.
 *
 * The server listens on 127.0.0.1 only (no firewall prompt, nothing exposed to the network), and
 * `adb reverse` makes the same port on the device lead to it, so Chrome opens
 * http://127.0.0.1:<port>/ as if the page were on the phone.
 */

export const SITE_DIR = path.join(PACKAGE_DIR, 'fixtures', 'web');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

export interface TestSite {
  port: number;
  /** The address Chrome on the device opens. */
  url: string;
  close(): Promise<void>;
}

/** Serves `dir` on 127.0.0.1, a free port. Only files inside `dir`; anything else is a 404. */
export async function startTestSite(dir = SITE_DIR): Promise<TestSite> {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    const file = path.resolve(root, `.${name.endsWith('/') ? `${name}index.html` : name}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function adb(args: string[], udid?: string): string {
  const sdk = findSdk();
  if (!sdk) throw new Error('No Android SDK: run pnpm mobile doctor');
  return execFileSync(sdkTools(sdk).adb, [...(udid ? ['-s', udid] : []), ...args], {
    encoding: 'utf8',
    env: androidEnv(),
  });
}

/** Makes `port` on the device lead to the same port on this machine; returns the undo. */
export function reversePort(port: number, udid?: string): () => void {
  adb(['reverse', `tcp:${port}`, `tcp:${port}`], udid);
  return () => {
    try {
      adb(['reverse', '--remove', `tcp:${port}`], udid);
    } catch {
      // The device may already be gone; nothing to undo then.
    }
  };
}

/** A Chrome session on the device: no app, the browser itself, driven through Chromedriver. */
export function chromeCapabilities(config: MobileConfig): Record<string, unknown> {
  return {
    platformName: 'Android',
    browserName: 'Chrome',
    'appium:automationName': 'UiAutomator2',
    ...(config.udid ? { 'appium:udid': config.udid } : { 'appium:avd': config.avd }),
    'appium:avdLaunchTimeout': config.bootTimeoutMs,
    'appium:avdReadyTimeout': config.bootTimeoutMs,
    'appium:newCommandTimeout': 300,
    'appium:chromedriverExecutableDir': config.chromedriverDir,
    // Chrome's welcome screens would sit over the page on a fresh device.
    'appium:chromeOptions': { args: ['--disable-fre', '--no-first-run', '--no-default-browser-check'] },
  };
}
