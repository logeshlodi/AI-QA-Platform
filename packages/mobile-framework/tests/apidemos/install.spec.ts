import { expect, test } from '../../src/fixtures';
import { APPS, appPath } from '../../src/apps';
import { mobileConfig } from '../../src/config';

test.describe('Installing and removing the app', { tag: ['@mobile', '@android'] }, () => {
  test('an uninstalled app is gone, and a reinstall brings it back and it starts', async ({
    app,
    api,
    driver,
  }) => {
    const id = APPS.apidemos.appPackage;
    expect(await driver.isAppInstalled(id)).toBe(true);

    await driver.removeApp(id);
    expect(await driver.isAppInstalled(id)).toBe(false);

    await driver.installApp(await appPath(APPS.apidemos, mobileConfig().appsDir));
    expect(await driver.isAppInstalled(id)).toBe(true);
    await app.activate();
    await api.home.waitUntilShown(30_000);
  });
});
