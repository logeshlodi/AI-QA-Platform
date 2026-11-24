import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

/**
 * Chromedriver for Chrome and the WebView on the device. Appium drives web content through a
 * Chromedriver whose major version matches the browser's, so `pnpm mobile chromedriver` asks the
 * device which versions it has and downloads the matching builds from Chrome for Testing, Google's
 * official channel for them. Appium is pointed at the folder (`chromedriverExecutableDir`) and picks
 * the one that fits; nothing is downloaded during a test run.
 */

export const CFT_INDEX =
  'https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json';

/** The packages whose web engine Appium may need: the Chrome app and the system WebView. */
/** Chromedriver up to 114 lives in Google's older store, which names the newest build per major. */
export const LEGACY_STORE = 'https://chromedriver.storage.googleapis.com';

export const BROWSER_PACKAGES = [
  'com.android.chrome',
  'com.google.android.webview',
  'com.android.webview',
] as const;

export interface CftIndex {
  builds: Record<
    string,
    { version: string; downloads: { chromedriver?: { platform: string; url: string }[] } }
  >;
}

export type CftPlatform = 'linux64' | 'mac-arm64' | 'mac-x64' | 'win32' | 'win64';

/** `versionName=131.0.6778.200` from `dumpsys package`, or undefined when the package is absent. */
export function parseVersionName(dumpsys: string): string | undefined {
  return /versionName=(\d+\.\d+\.\d+\.\d+)/.exec(dumpsys)?.[1];
}

export function cftPlatform(platform: NodeJS.Platform = process.platform, arch = process.arch): CftPlatform {
  if (platform === 'win32') return arch === 'ia32' ? 'win32' : 'win64';
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  return 'linux64';
}

/**
 * The Chromedriver for a browser version: the same build (major.minor.build) when Chrome for
 * Testing has it, otherwise the newest build of the same major version, which Chromedriver accepts.
 */
export function pickChromedriver(
  index: CftIndex,
  browserVersion: string,
  platform: CftPlatform,
): { version: string; url: string } {
  const [major] = browserVersion.split('.');
  const build = browserVersion.split('.').slice(0, 3).join('.');
  const withDriver = (key: string) => {
    const entry = index.builds[key];
    const url = entry?.downloads.chromedriver?.find((d) => d.platform === platform)?.url;
    return entry && url ? { version: entry.version, url } : undefined;
  };
  const exact = withDriver(build);
  if (exact) return exact;
  const sameMajor = Object.keys(index.builds)
    .filter((key) => key.split('.')[0] === major)
    .sort((a, b) => compareVersions(b, a));
  for (const key of sameMajor) {
    const found = withDriver(key);
    if (found) return found;
  }
  throw new Error(
    `Chrome for Testing has no Chromedriver ${major} for ${platform} (browser ${browserVersion}). ` +
      'Chrome for Testing starts at version 115; older ones come from the legacy store (resolveChromedriver).',
  );
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** The legacy store's zip name for a platform (it has no 64-bit Windows build; win32 runs on both). */
export function legacyZip(platform: CftPlatform): string {
  return {
    linux64: 'chromedriver_linux64.zip',
    'mac-arm64': 'chromedriver_mac_arm64.zip',
    'mac-x64': 'chromedriver_mac64.zip',
    win32: 'chromedriver_win32.zip',
    win64: 'chromedriver_win32.zip',
  }[platform];
}

/**
 * Where to get the Chromedriver for a browser version: Chrome for Testing from 115, the legacy
 * store before that (the Google Play emulator images ship Chrome 113 and never update it without a
 * Google sign-in).
 */
export async function resolveChromedriver(
  browserVersion: string,
  platform: CftPlatform,
  fetchImpl: typeof fetch = fetch,
): Promise<{ version: string; url: string }> {
  const major = Number(browserVersion.split('.')[0]);
  if (major >= 115) {
    const response = await fetchImpl(CFT_INDEX);
    if (!response.ok) throw new Error(`${CFT_INDEX}: HTTP ${response.status}`);
    return pickChromedriver((await response.json()) as CftIndex, browserVersion, platform);
  }
  const latest = `${LEGACY_STORE}/LATEST_RELEASE_${major}`;
  const response = await fetchImpl(latest);
  if (!response.ok) throw new Error(`${latest}: HTTP ${response.status} (no Chromedriver ${major})`);
  const version = (await response.text()).trim();
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error(`${latest}: unexpected answer "${version}"`);
  return { version, url: `${LEGACY_STORE}/${version}/${legacyZip(platform)}` };
}

/** The base64 MD5 that Google Cloud Storage sends in `x-goog-hash: crc32c=...,md5=...`. */
export function md5FromGoogHash(header: string | null): string | undefined {
  return header
    ?.split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith('md5='))
    ?.slice(4);
}

export function chromedriverFile(version: string, platform: CftPlatform): string {
  return `chromedriver-${version}${platform.startsWith('win') ? '.exe' : ''}`;
}

/**
 * Downloads one Chromedriver zip, checks it against the MD5 the storage server reports, unpacks it
 * and keeps the binary as `chromedriver-<version>` in `dir`. Then runs `--version` on it, so a file
 * that is not the expected build is never kept.
 */
export async function installChromedriver(
  pick: { version: string; url: string },
  platform: CftPlatform,
  dir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, chromedriverFile(pick.version, platform));
  if (fs.existsSync(target) && reportsVersion(target, pick.version)) return target;

  const work = fs.mkdtempSync(path.join(dir, '.download-'));
  try {
    const zip = path.join(work, 'chromedriver.zip');
    const response = await fetchImpl(pick.url, { redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error(`${pick.url}: HTTP ${response.status}`);
    const expected = md5FromGoogHash(response.headers.get('x-goog-hash'));
    if (!expected) throw new Error(`${pick.url}: the server sent no MD5 to check the download against`);
    await pipeline(Readable.fromWeb(response.body as WebReadableStream), fs.createWriteStream(zip));
    const actual = createHash('md5').update(fs.readFileSync(zip)).digest('base64');
    if (actual !== expected)
      throw new Error(`${pick.url}: MD5 ${actual}, the server says ${expected}. Not kept.`);

    unzip(zip, work);
    const binary = findFile(work, platform.startsWith('win') ? 'chromedriver.exe' : 'chromedriver');
    if (!binary) throw new Error(`${pick.url}: no chromedriver inside the zip`);
    fs.chmodSync(binary, 0o755);
    if (!reportsVersion(binary, pick.version)) {
      throw new Error(`${binary} does not report version ${pick.version}. Not kept.`);
    }
    fs.renameSync(binary, target);
    return target;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function reportsVersion(binary: string, version: string): boolean {
  try {
    return execFileSync(binary, ['--version'], { encoding: 'utf8', timeout: 30_000 }).includes(version);
  } catch {
    return false;
  }
}

/** Windows 10 and later ship bsdtar, which reads zip files; Linux and macOS have unzip. */
function unzip(zip: string, into: string): void {
  if (process.platform === 'win32') execFileSync('tar', ['-xf', zip, '-C', into]);
  else execFileSync('unzip', ['-q', '-o', zip, '-d', into]);
}

function findFile(dir: string, name: string): string | undefined {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) return full;
  }
  return undefined;
}
