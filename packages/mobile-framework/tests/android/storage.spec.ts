import { expect, test } from '../../src/fixtures';
import { DataScreen } from '../../src/screens/demo-app';

// Where an app keeps data decides what survives a restart and what "Clear storage" removes.

test.describe('Data the app keeps', { tag: ['@mobile', '@android'] }, () => {
  test.beforeEach(async ({ app, screens }) => {
    await app.reset();
    // A deep link sent before React Native has loaded is dropped: wait for the first screen.
    await screens.home.waitUntilShown(30_000);
    await app.deepLink('wdio://data-management');
    await screens.data.waitUntilShown(30_000);
  });

  test('data in memory is lost when the app restarts; data on disk is kept', async ({ app, screens }) => {
    await screens.data.save('memory', 'only in RAM');
    await screens.data.save('sqlite', 'kept in SQLite');
    expect(await screens.data.value('memory')).toBe('only in RAM');

    await app.relaunch();
    await screens.home.waitUntilShown(30_000);
    await app.deepLink('wdio://data-management');
    await screens.data.waitUntilShown(30_000);
    await expect.poll(() => screens.data.value('sqlite')).toBe('kept in SQLite');
    expect(await screens.data.value('memory')).toBe(DataScreen.EMPTY_MEMORY);
  });

  test('"Clear storage" removes what was kept on disk', async ({ app, screens }) => {
    await screens.data.save('sqlite', 'about to be cleared');
    await app.reset();
    await screens.home.waitUntilShown(30_000);
    await app.deepLink('wdio://data-management');
    await screens.data.waitUntilShown(30_000);
    await expect.poll(() => screens.data.value('sqlite')).toBe(DataScreen.NOTHING_SAVED);
  });
});
