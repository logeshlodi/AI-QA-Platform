import { spawn, execFileSync } from 'node:child_process';
import { androidEnv, findSdk, parseAdbDevices, sdkTools } from './android-sdk';
import { APPS, appState, download } from './apps';
import {
  BROWSER_PACKAGES,
  cftPlatform,
  installChromedriver,
  parseVersionName,
  resolveChromedriver,
} from './chromedriver';
import { mobileConfig } from './config';
import { checkReadiness, formatChecks } from './doctor';

// pnpm mobile doctor            what an Android run needs, and what is missing (changes nothing)
// pnpm mobile doctor --accel    also asks the emulator whether hardware acceleration works
// pnpm mobile apps              downloads the pinned apps and checks their SHA-256
// pnpm mobile chromedriver      downloads the Chromedrivers for the device's Chrome and WebView (device running)
// pnpm mobile emulator          boots the configured emulator in its own window (Appium can also boot it)
// pnpm mobile emulator --wait   ...and waits until Android has finished starting (for CI; --no-window too)
// pnpm mobile emulator stop     shuts down every running emulator

const config = mobileConfig();
const [command = 'doctor', ...rest] = process.argv.slice(2);

async function main(): Promise<number> {
  switch (command) {
    case 'doctor': {
      const checks = await checkReadiness(config);
      console.log(formatChecks(checks));
      if (rest.includes('--accel')) console.log(`\n${accelCheck()}`);
      return checks.every((c) => c.ok) ? 0 : 1;
    }
    case 'apps': {
      for (const app of Object.values(APPS)) {
        const state = await appState(app, config.appsDir);
        if (state === 'ok') {
          console.log(`ok   ${app.title} ${app.version} (already here, SHA-256 verified)`);
          continue;
        }
        console.log(
          `get  ${app.title} ${app.version}, ${(app.bytes / 1e6).toFixed(1)} MB, ${app.licence}\n     ${app.url}`,
        );
        const file = await download(app, config.appsDir);
        console.log(`ok   ${file}`);
      }
      return 0;
    }
    case 'chromedriver': {
      const sdk = findSdk();
      if (!sdk) throw new Error('No Android SDK: run pnpm mobile doctor');
      const adb = sdkTools(sdk).adb;
      const serial =
        config.udid ??
        parseAdbDevices(execFileSync(adb, ['devices'], { encoding: 'utf8', env: androidEnv() })).find(
          (d) => d.state === 'device',
        )?.serial;
      if (!serial) throw new Error('No device is running. Start the emulator first: pnpm mobile emulator');
      const versions = new Map<string, string>();
      for (const pkg of BROWSER_PACKAGES) {
        const dump = execFileSync(adb, ['-s', serial, 'shell', 'dumpsys', 'package', pkg], {
          encoding: 'utf8',
          env: androidEnv(),
          maxBuffer: 32 * 1024 * 1024,
        });
        const version = parseVersionName(dump);
        if (version) versions.set(pkg, version);
      }
      if (versions.size === 0) throw new Error(`${serial} has neither Chrome nor a WebView`);
      const platform = cftPlatform();
      for (const [pkg, version] of versions) {
        const pick = await resolveChromedriver(version, platform);
        console.log(`get  Chromedriver ${pick.version} for ${pkg} ${version}\n     ${pick.url}`);
        console.log(`ok   ${await installChromedriver(pick, platform, config.chromedriverDir)}`);
      }
      return 0;
    }
    case 'emulator': {
      const sdk = findSdk();
      if (!sdk) throw new Error('No Android SDK: run pnpm mobile doctor');
      const tools = sdkTools(sdk);
      if (rest[0] === 'stop') {
        const devices = parseAdbDevices(
          execFileSync(tools.adb, ['devices'], { encoding: 'utf8', env: androidEnv() }),
        );
        for (const d of devices.filter((x) => x.emulator)) {
          execFileSync(tools.adb, ['-s', d.serial, 'emu', 'kill'], { env: androidEnv() });
          console.log(`stopped ${d.serial}`);
        }
        return 0;
      }
      const running = parseAdbDevices(
        execFileSync(tools.adb, ['devices'], { encoding: 'utf8', env: androidEnv() }),
      ).find((d) => d.emulator && d.state === 'device');
      if (running) {
        console.log(`${running.serial} is already running`);
      } else {
        const args = ['-avd', config.avd, '-no-snapshot-save', '-no-boot-anim'];
        if (rest.includes('--no-window')) args.push('-no-window');
        const child = spawn(tools.emulator, args, { env: androidEnv(), detached: true, stdio: 'ignore' });
        child.unref();
        console.log(`booting ${config.avd}`);
      }
      if (!rest.includes('--wait')) {
        console.log('check with: adb devices');
        return 0;
      }
      const started = Date.now();
      while (Date.now() - started < config.bootTimeoutMs) {
        const booted = (() => {
          try {
            return execFileSync(tools.adb, ['shell', 'getprop', 'sys.boot_completed'], {
              encoding: 'utf8',
              env: androidEnv(),
              timeout: 10_000,
              stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
          } catch {
            return '';
          }
        })();
        if (booted === '1') {
          console.log(`Android is ready after ${Math.round((Date.now() - started) / 1000)} s`);
          return 0;
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
      console.error(`Android did not finish starting within ${config.bootTimeoutMs / 1000} s`);
      return 1;
    }
    default:
      console.error(
        `Unknown command "${command}". Use: doctor [--accel] | apps | chromedriver | emulator [stop]`,
      );
      return 2;
  }
}

function accelCheck(): string {
  const sdk = findSdk();
  if (!sdk) return 'acceleration: no SDK';
  try {
    return execFileSync(sdkTools(sdk).emulator, ['-accel-check'], {
      encoding: 'utf8',
      env: androidEnv(),
      timeout: 60_000,
    });
  } catch (error) {
    return `acceleration check failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
