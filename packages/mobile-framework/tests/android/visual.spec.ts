import { expect, test } from '../../src/fixtures';
import { appScreenshot, enterDemoMode, exitDemoMode } from '../../src/visual';

// Screens compared with a saved picture of how they should look, with the status bar frozen by
// Android's demo mode (src/visual.ts). The pictures were taken on the laptop's emulator
// (aiqa_api34, 1080 x 2400); another device or system image draws differently, so the CI emulator
// job leaves @visual out. `--update-snapshots` takes new pictures after an intended change.

test.describe('How the screens look', { tag: ['@mobile', '@android', '@visual'] }, () => {
  test.beforeEach(async ({ driver }) => {
    await enterDemoMode(driver);
  });
  test.afterEach(async ({ driver }) => {
    await exitDemoMode(driver);
  });

  test('the home screen looks as it did', async ({ screens, driver }) => {
    await screens.home.waitUntilShown();
    expect(await appScreenshot(driver)).toMatchSnapshot('home.png', { maxDiffPixelRatio: 0.01 });
  });

  test('the sign-in form looks as it did', async ({ screens, driver }) => {
    await screens.nav.open('Login');
    await screens.login.waitUntilShown();
    await screens.login.hideKeyboard();
    expect(await appScreenshot(driver)).toMatchSnapshot('login.png', { maxDiffPixelRatio: 0.01 });
  });
});
