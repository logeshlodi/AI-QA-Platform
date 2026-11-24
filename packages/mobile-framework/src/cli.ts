import { spawn, execFileSync } from 'node:child_process';
import { androidEnv, findSdk, parseAdbDevices, sdkTools } from './android-sdk';
import { APPS, appState, download } from './apps';
import { mobileConfig } from './config';
import { checkReadiness, formatChecks } from './doctor';

// pnpm mobile doctor            what an Android run needs, and what is missing (changes nothing)
// pnpm mobile doctor --accel    also asks the emulator whether hardware acceleration works
// pnpm mobile apps              downloads the pinned apps and checks their SHA-256
// pnpm mobile emulator          boots the configured emulator in its own window (Appium can also boot it)
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
      const child = spawn(tools.emulator, ['-avd', config.avd, '-no-snapshot-save', '-no-boot-anim'], {
        env: androidEnv(),
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      console.log(`booting ${config.avd}; check with: adb devices`);
      return 0;
    }
    default:
      console.error(`Unknown command "${command}". Use: doctor [--accel] | apps | emulator [stop]`);
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
