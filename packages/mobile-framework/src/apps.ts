import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

/**
 * The apps under test, pinned by version and SHA-256. They are downloaded by `pnpm mobile apps`
 * into AIQA_APPS_DIR and never committed. A file whose hash differs is refused, so a moved or
 * replaced release cannot slip into a run unnoticed.
 */
export interface AppSpec {
  name: AppName;
  title: string;
  version: string;
  licence: string;
  url: string;
  file: string;
  sha256: string;
  bytes: number;
  /** Android package and launch activity, for activateApp, terminateApp and startActivity. */
  appPackage: string;
  appActivity: string;
}

export type AppName = 'demo' | 'apidemos';

export const APPS: Record<AppName, AppSpec> = {
  demo: {
    name: 'demo',
    title: 'WebdriverIO native demo app',
    version: '2.2.0',
    licence: 'MIT',
    url: 'https://github.com/webdriverio/native-demo-app/releases/download/v2.2.0/android.wdio.native.app.v2.2.0.apk',
    file: 'android.wdio.native.app.v2.2.0.apk',
    sha256: 'fe1d605ce099c73d93f33e5cbcb0df0bea437ce57aaaaf156b3b0fa1ca54931d',
    bytes: 123_595_826,
    appPackage: 'com.wdiodemoapp',
    appActivity: 'com.wdiodemoapp.MainActivity',
  },
  apidemos: {
    name: 'apidemos',
    title: 'Appium ApiDemos',
    version: '6.0.18',
    licence: 'Apache-2.0',
    url: 'https://github.com/appium/android-apidemos/releases/download/v6.0.18/ApiDemos-debug.apk',
    file: 'ApiDemos-debug-6.0.18.apk',
    sha256: 'a9eecf37b26cd084855c530db81c2bb1b91f4c1b095a04f47aa7c20e2791f686',
    bytes: 6_521_217,
    appPackage: 'io.appium.android.apis',
    appActivity: 'io.appium.android.apis.ApiDemos',
  },
};

export async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export type AppState = 'ok' | 'missing' | 'wrong-hash';

export async function appState(app: AppSpec, dir: string): Promise<AppState> {
  const file = path.join(dir, app.file);
  if (!fs.existsSync(file)) return 'missing';
  return (await sha256(file)) === app.sha256 ? 'ok' : 'wrong-hash';
}

/** The path to an app that is present and verified, or an error that says how to get it. */
export async function appPath(app: AppSpec, dir: string): Promise<string> {
  const state = await appState(app, dir);
  if (state === 'ok') return path.join(dir, app.file);
  throw new Error(
    state === 'missing'
      ? `${app.title} ${app.version} is not downloaded. Run: pnpm mobile apps`
      : `${path.join(dir, app.file)} does not match the pinned SHA-256. Delete it and run: pnpm mobile apps`,
  );
}

/** Downloads one app to a temporary file, checks the hash, then moves it into place. */
export async function download(app: AppSpec, dir: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, app.file);
  const partial = `${target}.part`;
  const response = await fetchImpl(app.url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`${app.url}: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body as WebReadableStream), fs.createWriteStream(partial));
  const actual = await sha256(partial);
  if (actual !== app.sha256) {
    fs.rmSync(partial, { force: true });
    throw new Error(`${app.file}: SHA-256 ${actual}, expected ${app.sha256}. Not kept.`);
  }
  fs.renameSync(partial, target);
  return target;
}
