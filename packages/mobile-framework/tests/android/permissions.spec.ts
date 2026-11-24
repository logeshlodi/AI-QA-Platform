import { APP_STATE, expect, test } from '../../src/fixtures';

// Runtime permissions. Each test starts from "Clear storage", which also takes back every runtime
// permission, so the app asks again.

const CAMERA = 'android.permission.CAMERA';
const granted = async (driver: WebdriverIO.Browser) =>
  (await driver.execute('mobile: getPermissions', {
    type: 'granted',
    appPackage: 'com.wdiodemoapp',
  })) as string[];

test.describe('Runtime permissions', { tag: ['@mobile', '@android'] }, () => {
  test.beforeEach(async ({ app, screens }) => {
    await app.reset();
    await expect.poll(() => app.state()).toBe(APP_STATE.foreground);
    // A deep link sent before React Native has loaded is dropped: wait for the first screen.
    await screens.home.waitUntilShown(30_000);
    await app.deepLink('wdio://permissions');
    await screens.permissions.waitUntilShown(30_000);
  });

  test('asking for the camera shows Android\'s dialog, and "Don\'t allow" leaves it off', async ({
    screens,
    driver,
  }) => {
    expect(await screens.permissions.isOn('camera')).toBe(false);
    await screens.permissions.toggle('camera');
    await screens.permissionDialog.waitUntilShown();
    expect(await screens.permissionDialog.text()).toMatch(/take pictures and record video/i);

    await screens.permissionDialog.answer('deny');
    await expect.poll(() => screens.permissions.isOn('camera')).toBe(false);
    expect(await granted(driver)).not.toContain(CAMERA);
  });

  test('allowing the camera while the app is in use turns it on, and Android records the grant', async ({
    screens,
    driver,
  }) => {
    await screens.permissions.toggle('camera');
    await screens.permissionDialog.waitUntilShown();
    await screens.permissionDialog.answer('whileUsing');
    await expect.poll(() => screens.permissions.isOn('camera')).toBe(true);
    expect(await granted(driver)).toContain(CAMERA);
  });

  test('a permission granted outside the app shows as on when the app comes back', async ({
    app,
    screens,
    driver,
  }) => {
    await driver.execute('mobile: changePermissions', {
      permissions: [CAMERA],
      appPackage: 'com.wdiodemoapp',
      action: 'grant',
    });
    await app.background(1);
    await expect.poll(() => screens.permissions.isOn('camera')).toBe(true);
  });
});
