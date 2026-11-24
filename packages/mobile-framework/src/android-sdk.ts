import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Finds the Android SDK and a JDK without asking anyone to set system variables: the scripts and
// the Appium server get ANDROID_HOME and JAVA_HOME in their own environment only.

const exe = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);

/** Where Android Studio and the command-line tools put the SDK, in the order they are tried. */
export function sdkCandidates(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string[] {
  const local = env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
  return [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    process.platform === 'win32' ? path.join(local, 'Android', 'Sdk') : undefined,
    process.platform === 'darwin' ? path.join(home, 'Library', 'Android', 'sdk') : undefined,
    path.join(home, 'Android', 'Sdk'),
  ].filter((p): p is string => Boolean(p));
}

/** The first candidate that has platform-tools/adb in it. */
export function findSdk(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string | undefined {
  return sdkCandidates(env, home).find((dir) => fs.existsSync(path.join(dir, 'platform-tools', exe('adb'))));
}

/** JAVA_HOME if set, else the JDK that `java` on PATH belongs to, else Android Studio's bundled one. */
export function findJavaHome(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const hasJava = (dir: string) => fs.existsSync(path.join(dir, 'bin', exe('java')));
  if (env.JAVA_HOME && hasJava(env.JAVA_HOME)) return env.JAVA_HOME;
  for (const dir of (env.PATH ?? env.Path ?? '').split(path.delimiter)) {
    if (dir && fs.existsSync(path.join(dir, exe('java')))) {
      const home = path.dirname(dir);
      if (hasJava(home)) return home;
    }
  }
  const studio =
    process.platform === 'win32'
      ? path.join(env.ProgramFiles ?? 'C:\\Program Files', 'Android', 'Android Studio', 'jbr')
      : '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  return hasJava(studio) ? studio : undefined;
}

export interface SdkTools {
  sdk: string;
  adb: string;
  emulator: string;
  avdmanager?: string;
}

export function sdkTools(sdk: string): SdkTools {
  const cmdline = path.join(sdk, 'cmdline-tools', 'latest', 'bin');
  const avdmanager = path.join(cmdline, process.platform === 'win32' ? 'avdmanager.bat' : 'avdmanager');
  return {
    sdk,
    adb: path.join(sdk, 'platform-tools', exe('adb')),
    emulator: path.join(sdk, 'emulator', exe('emulator')),
    avdmanager: fs.existsSync(avdmanager) ? avdmanager : undefined,
  };
}

/** The environment for anything that talks to the SDK: Appium, adb, the emulator. */
export function androidEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const sdk = findSdk(env);
  const javaHome = findJavaHome(env);
  return {
    ...env,
    ...(sdk ? { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk } : {}),
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
  };
}

export interface AdbDevice {
  serial: string;
  state: string;
  emulator: boolean;
}

/**
 * Parses `adb devices` output: the lines after "List of devices attached" (when the adb server has
 * just started, its own status lines come first). Only `device` means ready; `offline` and
 * `unauthorized` are reported as they are.
 */
export function parseAdbDevices(output: string): AdbDevice[] {
  const lines = output.split(/\r?\n/);
  const header = lines.findIndex((line) => line.startsWith('List of devices'));
  return lines
    .slice(header + 1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[0] && !parts[0].startsWith('*'))
    .map(([serial = '', state = '']) => ({ serial, state, emulator: serial.startsWith('emulator-') }));
}

/** System images installed in the SDK, as `android-34/google_apis/x86_64`. */
export function systemImages(sdk: string): string[] {
  const root = path.join(sdk, 'system-images');
  if (!fs.existsSync(root)) return [];
  const found: string[] = [];
  for (const api of fs.readdirSync(root)) {
    for (const tag of safeDirs(path.join(root, api))) {
      for (const abi of safeDirs(path.join(root, api, tag))) found.push(`${api}/${tag}/${abi}`);
    }
  }
  return found.sort();
}

function safeDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Emulators defined in Android Studio's Device Manager (the .ini files under ~/.android/avd). */
export function avds(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string[] {
  const dir = env.ANDROID_AVD_HOME ?? path.join(env.ANDROID_USER_HOME ?? path.join(home, '.android'), 'avd');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ini'))
    .map((f) => f.slice(0, -4))
    .sort();
}
