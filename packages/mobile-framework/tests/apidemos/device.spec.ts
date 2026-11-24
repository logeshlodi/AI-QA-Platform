import { expect, test } from '../../src/fixtures';
import { canReachInternet, wifiRadioOn } from '../../src/device';
import { ACTIVITY } from '../../src/screens/apidemos';

// The device around the app: rotation, clipboard, location, network and battery. Each test puts
// back what it changed, so the next test (and the next run) starts from the same device.

test.describe('Device state', { tag: ['@mobile', '@android'] }, () => {
  test('rotating to landscape swaps the screen dimensions, and the screen keeps its state', async ({
    app,
    api,
    driver,
  }) => {
    await app.open(ACTIVITY.controls);
    await api.controls.waitUntilShown();
    await api.controls.toggle('check1');
    const portrait = await driver.getWindowSize();
    try {
      await driver.setOrientation('LANDSCAPE');
      await expect.poll(async () => (await driver.getWindowSize()).width).toBeGreaterThan(portrait.width);
      expect(await api.controls.isChecked('check1')).toBe(true);
    } finally {
      await driver.setOrientation('PORTRAIT');
    }
  });

  test('text put on the clipboard can be pasted into a field', async ({ app, api, driver }) => {
    await app.open(ACTIVITY.controls);
    await api.controls.waitUntilShown();
    await driver.setClipboard(Buffer.from('copied by the test').toString('base64'), 'plaintext');
    expect(Buffer.from(await driver.getClipboard('plaintext'), 'base64').toString()).toBe(
      'copied by the test',
    );

    await api.controls.focusText();
    await driver.pressKeyCode(279); // KEYCODE_PASTE
    await expect.poll(() => api.controls.text()).toBe('copied by the test');
  });

  test('the emulator reports the location the test sets', async ({ driver }) => {
    const bengaluru = { latitude: 12.9716, longitude: 77.5946, altitude: 920 };
    await driver.setGeoLocation(bengaluru);
    // The location service takes a moment to report a new fix; reading at once can fail.
    await expect
      .poll(async () => (await driver.getGeoLocation().catch(() => ({ latitude: 0 }))).latitude)
      .toBeCloseTo(bengaluru.latitude, 3);
    expect((await driver.getGeoLocation()).longitude).toBeCloseTo(bengaluru.longitude, 3);
  });

  test('Wi-Fi can be switched off and back on, and the device reports each state', async ({ driver }) => {
    type Connectivity = { wifi: boolean; data: boolean; airplaneMode: boolean };
    const before = (await driver.execute('mobile: getConnectivity', {})) as Connectivity;
    try {
      await driver.execute('mobile: setConnectivity', { wifi: false });
      await expect
        .poll(async () => ((await driver.execute('mobile: getConnectivity', {})) as Connectivity).wifi)
        .toBe(false);
    } finally {
      await driver.execute('mobile: setConnectivity', { wifi: before.wifi });
    }
    await expect
      .poll(async () => ((await driver.execute('mobile: getConnectivity', {})) as Connectivity).wifi)
      .toBe(before.wifi);
    // The setting is back at once; the connection takes a few seconds more.
    await expect.poll(() => canReachInternet(driver), { timeout: 30_000 }).toBe(true);
  });

  test('in airplane mode the device cannot reach the internet, and switching it off brings it back', async ({
    driver,
  }) => {
    // Online first: an earlier test may have just switched Wi-Fi back on.
    await expect.poll(() => canReachInternet(driver), { timeout: 30_000 }).toBe(true);
    try {
      await driver.execute('mobile: setConnectivity', { airplaneMode: true });
      await expect.poll(() => canReachInternet(driver)).toBe(false);
      expect(await wifiRadioOn(driver)).toBe(false);
    } finally {
      await driver.execute('mobile: setConnectivity', { airplaneMode: false });
    }
    await expect.poll(() => canReachInternet(driver), { timeout: 30_000 }).toBe(true);
    expect(await wifiRadioOn(driver)).toBe(true);
  });

  test('the device reports its Android version and battery', async ({ driver }) => {
    const info = (await driver.execute('mobile: deviceInfo', {})) as {
      apiVersion: string;
      platformVersion: string;
    };
    expect(Number(info.apiVersion)).toBeGreaterThanOrEqual(26);
    const battery = (await driver.execute('mobile: batteryInfo', {})) as { level: number; state: number };
    expect(battery.level).toBeGreaterThanOrEqual(0);
    expect(battery.level).toBeLessThanOrEqual(1);
  });
});
