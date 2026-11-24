import { APP_STATE, expect, test } from '../../src/fixtures';

test.describe(
  'The app being stopped, started and sent to the background',
  { tag: ['@mobile', '@android'] },
  () => {
    test('a stopped app is not running, and starting it again opens the home screen', async ({
      app,
      screens,
    }) => {
      await app.terminate();
      expect(await app.state()).toBe(APP_STATE.notRunning);

      await app.activate();
      await expect.poll(() => app.state()).toBe(APP_STATE.foreground);
      await screens.home.waitUntilShown(30_000);
    });

    test('what was typed is still there after the app comes back from the background', async ({
      app,
      screens,
    }) => {
      await screens.nav.open('Forms');
      await screens.forms.waitUntilShown();
      await screens.forms.type('kept while away');

      await app.background(3);

      await expect.poll(() => app.state()).toBe(APP_STATE.foreground);
      expect(await screens.forms.echoedText()).toBe('kept while away');
    });

    test('every test starts on the home screen, whatever the one before it left open', async ({
      app,
      screens,
    }) => {
      await screens.nav.open('Drag');
      await screens.drag.waitUntilShown();
      await app.relaunch();
      await expect.poll(() => screens.home.isShown(), { timeout: 30_000 }).toBe(true);
      expect(await screens.drag.isShown()).toBe(false);
    });
  },
);
