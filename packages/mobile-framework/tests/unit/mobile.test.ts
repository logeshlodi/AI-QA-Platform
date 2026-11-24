import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditPageSource } from '../../src/a11y';
import { avds, findSdk, parseAdbDevices, systemImages } from '../../src/android-sdk';
import { APPS, appPath, appState, download, sha256, type AppSpec } from '../../src/apps';
import { androidCapabilities, fakeCapabilities } from '../../src/capabilities';
import {
  cftPlatform,
  type CftIndex,
  chromedriverFile,
  compareVersions,
  installChromedriver,
  md5FromGoogHash,
  parseVersionName,
  pickChromedriver,
  resolveChromedriver,
} from '../../src/chromedriver';
import { mobileConfig, PACKAGE_DIR } from '../../src/config';
import { formatChecks, installedDrivers } from '../../src/doctor';
import { parseAmStart, parseMeminfoPssKb, parseTopCpu } from '../../src/performance';
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

  it('reads ~ in a folder setting as the home folder, for a cache CI keeps between builds', () => {
    const config = mobileConfig({ AIQA_APPS_DIR: '~/.aiqa/mobile/apps', AIQA_CHROMEDRIVER_DIR: '/opt/cd' });
    expect(config.appsDir).toBe(path.join(os.homedir(), '.aiqa', 'mobile', 'apps'));
    expect(config.chromedriverDir).toBe('/opt/cd');
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

describe('Chromedriver for the device', () => {
  const index: CftIndex = {
    builds: {
      '113.0.5672': { version: '113.0.5672.63', downloads: {} },
      '131.0.6778': {
        version: '131.0.6778.204',
        downloads: { chromedriver: [{ platform: 'win64', url: 'https://example.test/131.204/win64.zip' }] },
      },
      '131.0.6723': {
        version: '131.0.6723.116',
        downloads: { chromedriver: [{ platform: 'win64', url: 'https://example.test/131.116/win64.zip' }] },
      },
      '132.0.6834': {
        version: '132.0.6834.83',
        downloads: { chromedriver: [{ platform: 'linux64', url: 'https://example.test/132/linux64.zip' }] },
      },
    },
  };

  it('reads the version of an installed package and says nothing for a missing one', () => {
    expect(
      parseVersionName('  Packages:\n    versionCode=677812333 minSdk=29\n    versionName=131.0.6778.200\n'),
    ).toBe('131.0.6778.200');
    expect(parseVersionName('Unable to find package: com.android.chrome')).toBeUndefined();
  });

  it('takes the same build when it exists, else the newest of the same major version', () => {
    expect(pickChromedriver(index, '131.0.6778.200', 'win64').version).toBe('131.0.6778.204');
    expect(pickChromedriver(index, '131.0.6700.10', 'win64').version).toBe('131.0.6778.204');
    expect(() => pickChromedriver(index, '132.0.6834.83', 'win64')).toThrow(/no Chromedriver 132 for win64/);
    expect(() => pickChromedriver(index, '113.0.5672.63', 'win64')).toThrow(/legacy store/);
  });

  it('goes to the legacy store before 115, and to Chrome for Testing from 115', async () => {
    const asked: string[] = [];
    const fakeFetch = (async (url: string) => {
      asked.push(url);
      return url.includes('LATEST_RELEASE_113') ? new Response('113.0.5672.63\n') : Response.json(index);
    }) as typeof fetch;
    expect(await resolveChromedriver('113.0.5672.136', 'win64', fakeFetch)).toEqual({
      version: '113.0.5672.63',
      url: 'https://chromedriver.storage.googleapis.com/113.0.5672.63/chromedriver_win32.zip',
    });
    expect((await resolveChromedriver('131.0.6778.200', 'win64', fakeFetch)).version).toBe('131.0.6778.204');
    expect(asked).toEqual([
      'https://chromedriver.storage.googleapis.com/LATEST_RELEASE_113',
      'https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json',
    ]);
  });

  it('compares versions number by number', () => {
    expect(compareVersions('131.0.6778', '131.0.6723')).toBeGreaterThan(0);
    expect(compareVersions('99.0.1', '131.0.1')).toBeLessThan(0);
  });

  it('maps the machine to its Chrome for Testing platform and names the binary', () => {
    expect(cftPlatform('win32', 'x64')).toBe('win64');
    expect(cftPlatform('darwin', 'arm64')).toBe('mac-arm64');
    expect(cftPlatform('linux', 'x64')).toBe('linux64');
    expect(chromedriverFile('131.0.6778.204', 'win64')).toBe('chromedriver-131.0.6778.204.exe');
    expect(chromedriverFile('131.0.6778.204', 'linux64')).toBe('chromedriver-131.0.6778.204');
  });

  it('reads the MD5 from the storage server header', () => {
    expect(md5FromGoogHash('crc32c=AAAAAA==, md5=1B2M2Y8AsgTpgAmY7PhCfg==')).toBe('1B2M2Y8AsgTpgAmY7PhCfg==');
    expect(md5FromGoogHash('crc32c=AAAAAA==')).toBeUndefined();
    expect(md5FromGoogHash(null)).toBeUndefined();
  });

  it('keeps nothing when the download does not match the MD5 the server sent', async () => {
    const dir = temp();
    const fakeFetch = (async () =>
      new Response('not a zip', {
        headers: { 'x-goog-hash': 'md5=1B2M2Y8AsgTpgAmY7PhCfg==' },
      })) as typeof fetch;
    await expect(
      installChromedriver(
        { version: '131.0.6778.204', url: 'https://example.test/x.zip' },
        'linux64',
        dir,
        fakeFetch,
      ),
    ).rejects.toThrow(/Not kept/);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('refuses a download the server gives no MD5 for', async () => {
    const dir = temp();
    const fakeFetch = (async () => new Response('x')) as typeof fetch;
    await expect(
      installChromedriver(
        { version: '1.0.0.0', url: 'https://example.test/x.zip' },
        'linux64',
        dir,
        fakeFetch,
      ),
    ).rejects.toThrow(/no MD5/);
  });
});

describe('accessibility audit of a UI tree', () => {
  const tree = (body: string) =>
    `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy index="0" rotation="0">${body}</hierarchy>`;
  const node = (attrs: string, children = '') =>
    `<android.view.View ${attrs} displayed="true">${children}</android.view.View>`;

  it('accepts a labelled button of 48 dp, and a button labelled by the text inside it', () => {
    // density 420 (the emulator): 48 dp is 126 px.
    const xml = tree(
      node('class="android.widget.Button" text="Sign in" clickable="true" bounds="[0,0][300,126]"') +
        node(
          'class="android.view.ViewGroup" resource-id="app:id/row" clickable="true" bounds="[0,200][1080,400]"',
          node('class="android.widget.TextView" text="Settings" clickable="false" bounds="[0,200][500,300]"'),
        ),
    );
    expect(auditPageSource(xml, 420)).toEqual([]);
  });

  it('reports a control with nothing to read out, and one smaller than 48 dp', () => {
    const xml = tree(
      node(
        'class="android.widget.ImageButton" resource-id="app:id/close" clickable="true" bounds="[0,0][90,90]"',
      ),
    );
    expect(auditPageSource(xml, 420)).toEqual([
      { rule: 'label', element: 'ImageButton app:id/close', detail: 'nothing for a screen reader to say' },
      { rule: 'target-size', element: 'ImageButton app:id/close', detail: '34 x 34 dp, under 48 x 48' },
    ]);
  });

  it('ignores what is not tappable, has no size, or belongs to the system bars', () => {
    const xml = tree(
      node('class="android.widget.TextView" text="" clickable="false" bounds="[0,0][10,10]"') +
        node('class="android.widget.Button" clickable="true" bounds="[0,0][0,0]"') +
        node(
          'class="android.view.View" resource-id="android:id/statusBarBackground" clickable="true" bounds="[0,0][1080,20]"',
        ),
    );
    expect(auditPageSource(xml, 420)).toEqual([]);
  });
});

describe('performance readings from Android', () => {
  it('reads the launch time from am start -W', () => {
    const out =
      'Status: ok\nLaunchState: COLD\nActivity: com.x/.Main\nTotalTime: 1834\nWaitTime: 1850\nComplete\n';
    expect(parseAmStart(out)).toEqual({ totalTimeMs: 1834, waitTimeMs: 1850, launchState: 'COLD' });
    expect(() => parseAmStart('Error: Activity not started')).toThrow(/No TotalTime/);
  });

  it('reads TOTAL PSS from dumpsys meminfo, in either layout', () => {
    expect(
      parseMeminfoPssKb('App Summary\n ...\n           TOTAL PSS:   187654       TOTAL RSS:   250000'),
    ).toBe(187654);
    expect(parseMeminfoPssKb('        TOTAL   123456    100    200')).toBe(123456);
  });

  it('reads the process CPU share from top', () => {
    const out =
      'Tasks: 1 total\n  PID USER         PR  NI VIRT  RES  SHR S[%CPU] %MEM     TIME+ ARGS\n 4321 u0_a190      10 -10  14G 210M 120M S 37.5   5.1   0:12.34 com.wdiodemoapp\n';
    expect(parseTopCpu(out, 4321)).toBe(37.5);
    expect(() => parseTopCpu(out, 99)).toThrow(/not in top/);
  });
});
