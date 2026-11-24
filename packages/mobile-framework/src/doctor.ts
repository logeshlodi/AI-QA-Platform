import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  androidEnv,
  avds,
  findJavaHome,
  findSdk,
  parseAdbDevices,
  sdkTools,
  systemImages,
} from './android-sdk';
import { APPS, appState } from './apps';
import { PACKAGE_DIR, type MobileConfig } from './config';

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  /** What to do when it is not ok. */
  fix?: string;
}

/**
 * Everything an Android run needs, checked without changing anything. `pnpm mobile doctor` prints
 * it; the android project's setup step fails with it, so a missing piece is named before any test runs.
 */
export async function checkReadiness(
  config: MobileConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Check[]> {
  const checks: Check[] = [];
  const sdk = findSdk(env);
  checks.push({
    name: 'Android SDK',
    ok: Boolean(sdk),
    detail: sdk ?? 'not found',
    fix: 'Install Android Studio, or set ANDROID_HOME to an SDK with platform-tools.',
  });

  const java = findJavaHome(env);
  checks.push({
    name: 'JDK',
    ok: Boolean(java),
    detail: java ?? 'not found',
    fix: 'Install a JDK (Temurin 21 or later), or set JAVA_HOME. UiAutomator2 signs its helper apps with it.',
  });

  const drivers = installedDrivers();
  checks.push({
    name: 'Appium driver',
    ok: drivers.includes('appium-uiautomator2-driver'),
    detail: drivers.length ? drivers.join(', ') : 'none',
    fix: 'Run pnpm install: the driver is a dependency of packages/mobile-framework.',
  });

  for (const app of Object.values(APPS)) {
    const state = await appState(app, config.appsDir);
    checks.push({
      name: `App: ${app.title}`,
      ok: state === 'ok',
      detail: state === 'ok' ? `${app.version}, SHA-256 verified` : state,
      fix: 'Run: pnpm mobile apps',
    });
  }

  if (!sdk) return checks;
  const tools = sdkTools(sdk);
  const devices = readDevices(tools.adb);
  const ready = devices.filter((d) => d.state === 'device');
  const images = systemImages(sdk);
  const defined = avds(env);

  if (config.udid) {
    const found = ready.some((d) => d.serial === config.udid);
    checks.push({
      name: 'Device (AIQA_ANDROID_UDID)',
      ok: found,
      detail: found ? `${config.udid} is connected` : `${config.udid} is not in adb devices`,
      fix: 'Connect the device and allow USB debugging, or unset AIQA_ANDROID_UDID to use the emulator.',
    });
    return checks;
  }

  checks.push({
    name: 'System image',
    ok: images.some((i) => i.includes('x86_64') || i.includes('arm64')),
    detail: images.length ? images.join(', ') : 'none installed',
    fix: 'Android Studio > SDK Manager > SDK Platforms > Show Package Details > Android 14 (API 34) > Google APIs Intel x86_64 Atom System Image.',
  });
  checks.push({
    name: `Emulator "${config.avd}"`,
    ok: defined.includes(config.avd) || ready.length > 0,
    detail: defined.includes(config.avd)
      ? 'defined'
      : ready.length
        ? `not defined, but ${ready.map((d) => d.serial).join(', ')} is connected and will be used`
        : `not defined (have: ${defined.join(', ') || 'none'})`,
    fix: `Android Studio > Device Manager > Create virtual device > Pixel 7 > the API 34 Google APIs image > name it ${config.avd}. Or set AIQA_AVD to one you have.`,
  });
  checks.push({
    name: 'Android Emulator',
    ok: fs.existsSync(tools.emulator) || ready.length > 0,
    detail: fs.existsSync(tools.emulator)
      ? 'installed (`pnpm mobile doctor --accel` also checks hardware acceleration)'
      : 'not installed',
    fix: 'Android Studio > SDK Manager > SDK Tools > Android Emulator.',
  });
  return checks;
}

/** Driver packages Appium will find through APPIUM_HOME: the package's own dependencies. */
export function installedDrivers(): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter((name) => /appium-.*-driver$|^@appium\/.*-driver$/.test(name))
    .filter((name) => fs.existsSync(path.join(PACKAGE_DIR, 'node_modules', name, 'package.json')))
    .sort();
}

function readDevices(adb: string) {
  try {
    return parseAdbDevices(
      execFileSync(adb, ['devices'], { encoding: 'utf8', env: androidEnv(), timeout: 15_000 }),
    );
  } catch {
    return [];
  }
}

export function formatChecks(checks: Check[]): string {
  const lines = checks.map(
    (c) => `${c.ok ? 'ok  ' : 'FIX '} ${c.name}: ${c.detail}${c.ok || !c.fix ? '' : `\n       ${c.fix}`}`,
  );
  const failing = checks.filter((c) => !c.ok).length;
  lines.push('', failing ? `${failing} thing(s) to fix before an Android run.` : 'Ready for an Android run.');
  return lines.join('\n');
}
