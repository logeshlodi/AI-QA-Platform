import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { avds, findSdk, parseAdbDevices, systemImages } from '../../src/android-sdk';
import { APPS, appPath, appState, download, sha256, type AppSpec } from '../../src/apps';
import { androidCapabilities, fakeCapabilities } from '../../src/capabilities';
import { mobileConfig, PACKAGE_DIR } from '../../src/config';
import { formatChecks, installedDrivers } from '../../src/doctor';
import { shellQuote, xpathLiteral } from '../../src/screens/apidemos';
import { isCardTitle, pickNearestToCentre } from '../../src/screens/demo-app';

const temps: string[] = [];
function temp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-mobile-'));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('mobileConfig', () => {
  it('uses the laptop defaults when nothing is set', () => {
    const config = mobileConfig({});
    expect(config.avd).toBe('aiqa_api34');
    expect(config.udid).toBeUndefined();
    expect(config.appsDir).toMatch(/\.aiqa[\\/]mobile[\\/]apps$/);
    expect(config.videoAlways).toBe(false);
  });

  it('takes a device, an emulator name and the video switch from the environment', () => {
    const config = mobileConfig({
      AIQA_ANDROID_UDID: ' emulator-5556 ',
      AIQA_AVD: 'pixel',
      AIQA_MOBILE_VIDEO: 'on',
    });
    expect(config).toMatchObject({ udid: 'emulator-5556', avd: 'pixel', videoAlways: true });
  });
});

describe('Android SDK discovery', () => {
  it('finds the first candidate that has adb in platform-tools', () => {
    const sdk = temp();
    const adb = process.platform === 'win32' ? 'adb.exe' : 'adb';
    fs.mkdirSync(path.join(sdk, 'platform-tools'), { recursive: true });
    fs.writeFileSync(path.join(sdk, 'platform-tools', adb), '');
    expect(findSdk({ ANDROID_HOME: path.join(sdk, 'missing'), ANDROID_SDK_ROOT: sdk }, temp())).toBe(sdk);
  });

  it('lists system images as api/tag/abi, and emulators from the .ini files', () => {
    const sdk = temp();
    fs.mkdirSync(path.join(sdk, 'system-images', 'android-34', 'google_apis', 'x86_64'), { recursive: true });
    expect(systemImages(sdk)).toEqual(['android-34/google_apis/x86_64']);
    expect(systemImages(temp())).toEqual([]);

    const avdHome = temp();
    fs.writeFileSync(path.join(avdHome, 'aiqa_api34.ini'), '');
    fs.mkdirSync(path.join(avdHome, 'aiqa_api34.avd'));
    expect(avds({ ANDROID_AVD_HOME: avdHome })).toEqual(['aiqa_api34']);
  });

  it('reads adb devices, keeping offline and unauthorized devices as they are', () => {
    const out = [
      '* daemon started successfully',
      'List of devices attached',
      'emulator-5554\tdevice',
      'R58M123ABC\tunauthorized',
      'emulator-5556\toffline',
      '',
    ].join('\r\n');
    // The adb server's status line comes before the header when it has just started.
    expect(parseAdbDevices(out)).toEqual([
      { serial: 'emulator-5554', state: 'device', emulator: true },
      { serial: 'R58M123ABC', state: 'unauthorized', emulator: false },
      { serial: 'emulator-5556', state: 'offline', emulator: true },
    ]);
    expect(parseAdbDevices('List of devices attached\n\n')).toEqual([]);
  });
});

describe('the pinned apps', () => {
  const tiny: AppSpec = {
    ...APPS.apidemos,
    file: 'tiny.apk',
    url: 'https://example.test/tiny.apk',
    sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', // sha256("hello")
    bytes: 5,
  };

  it('pins a version, a licence and a SHA-256 for each app', () => {
    for (const app of Object.values(APPS)) {
      expect(app.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(app.url).toContain(app.version);
      expect(['MIT', 'Apache-2.0']).toContain(app.licence);
    }
  });

  it('tells a missing app from one whose hash is wrong, and refuses both', async () => {
    const dir = temp();
    expect(await appState(tiny, dir)).toBe('missing');
    await expect(appPath(tiny, dir)).rejects.toThrow(/pnpm mobile apps/);
    fs.writeFileSync(path.join(dir, 'tiny.apk'), 'tampered');
    expect(await appState(tiny, dir)).toBe('wrong-hash');
    await expect(appPath(tiny, dir)).rejects.toThrow(/does not match the pinned SHA-256/);
    fs.writeFileSync(path.join(dir, 'tiny.apk'), 'hello');
    expect(await appPath(tiny, dir)).toBe(path.join(dir, 'tiny.apk'));
  });

  it('keeps a download only when its hash matches', async () => {
    const dir = temp();
    const serve = (body: string) => (async () => new Response(body)) as unknown as typeof fetch;
    await expect(download(tiny, dir, serve('not hello'))).rejects.toThrow(/expected 2cf24/);
    expect(fs.readdirSync(dir)).toEqual([]);
    const file = await download(tiny, dir, serve('hello'));
    expect(await sha256(file)).toBe(tiny.sha256);
  });
});

describe('capabilities', () => {
  it('boots the named emulator unless a device is given', () => {
    const viaAvd = androidCapabilities(APPS.demo, '/apps/demo.apk', mobileConfig({}));
    expect(viaAvd).toMatchObject({
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:app': '/apps/demo.apk',
      'appium:avd': 'aiqa_api34',
      'appium:disableWindowAnimation': true,
      'appium:autoGrantPermissions': false,
    });
    expect(viaAvd).not.toHaveProperty('appium:udid');

    const viaUdid = androidCapabilities(
      APPS.demo,
      '/apps/demo.apk',
      mobileConfig({ AIQA_ANDROID_UDID: 'R58M' }),
    );
    expect(viaUdid['appium:udid']).toBe('R58M');
    expect(viaUdid).not.toHaveProperty('appium:avd');
  });

  it('prefixes every non-standard capability with appium:', () => {
    for (const caps of [androidCapabilities(APPS.demo, 'a.apk', mobileConfig({})), fakeCapabilities()]) {
      for (const key of Object.keys(caps))
        expect(key === 'platformName' || key.startsWith('appium:')).toBe(true);
    }
  });
});

describe('doctor', () => {
  // The test image (infrastructure/docker/Dockerfile) does not install the mobile package.
  const installed = fs.existsSync(path.join(PACKAGE_DIR, 'node_modules', 'appium'));
  it.skipIf(!installed)('finds the pinned drivers in the package, the way Appium does', () => {
    expect(installedDrivers()).toEqual(['@appium/fake-driver', 'appium-uiautomator2-driver']);
  });

  it('says what to fix, and only for what is missing', () => {
    const text = formatChecks([
      { name: 'Android SDK', ok: true, detail: 'C:\\Sdk', fix: 'never shown' },
      { name: 'Emulator', ok: false, detail: 'not defined', fix: 'Create it in Device Manager' },
    ]);
    expect(text).toContain('ok   Android SDK: C:\\Sdk');
    expect(text).toContain('FIX  Emulator: not defined\n       Create it in Device Manager');
    expect(text).not.toContain('never shown');
    expect(text).toContain('1 thing(s) to fix');
  });
});

describe('pickNearestToCentre', () => {
  it('picks the card whose middle is closest to the middle of the screen', () => {
    const rects = [
      { x: -300, width: 360 },
      { x: 20, width: 360 },
      { x: 340, width: 360 },
    ];
    expect(pickNearestToCentre(rects, 400)).toBe(1);
    expect(pickNearestToCentre([{ x: 0, width: 0 }], 400)).toBe(-1);
    expect(pickNearestToCentre([], 400)).toBe(-1);
  });
});

describe('isCardTitle', () => {
  it('takes the upper-cased title and skips the icon glyph and the body text', () => {
    expect(isCardTitle('FULLY OPEN SOURCE')).toBe(true);
    expect(isCardTitle('\u{f02a4}')).toBe(false);
    expect(isCardTitle('WebdriverIO is fully open source')).toBe(false);
  });
});

describe('quoting for the device', () => {
  it('quotes a shell argument so spaces and quotes survive', () => {
    expect(shellQuote('Order 1042 shipped')).toBe("'Order 1042 shipped'");
    expect(shellQuote("it's here")).toBe("'it'\\''s here'");
  });

  it('writes any text as an XPath literal', () => {
    expect(xpathLiteral('Short notification')).toBe('"Short notification"');
    expect(xpathLiteral('say "hi"')).toBe(`'say "hi"'`);
    expect(xpathLiteral(`it's "x"`)).toBe(`concat("it's ", '"', "x", '"', "")`);
  });
});
