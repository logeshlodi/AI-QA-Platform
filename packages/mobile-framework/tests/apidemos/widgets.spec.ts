import { expect, test } from '../../src/fixtures';
import { ACTIVITY, ControlsScreen } from '../../src/screens/apidemos';

test.describe('Native Android widgets', { tag: ['@mobile', '@android'] }, () => {
  test.describe('check boxes, radio buttons, toggles, spinner, text', () => {
    test.beforeEach(async ({ app, api }) => {
      await app.open(ACTIVITY.controls);
      await api.controls.waitUntilShown();
    });

    test('ticking one check box leaves the other as it was', async ({ api }) => {
      await api.controls.toggle('check1');
      expect(await api.controls.isChecked('check1')).toBe(true);
      expect(await api.controls.isChecked('check2')).toBe(false);
      await api.controls.toggle('check1');
      expect(await api.controls.isChecked('check1')).toBe(false);
    });

    test('choosing one radio button clears the other', async ({ api }) => {
      await api.controls.toggle('radio1');
      expect(await api.controls.isChecked('radio1')).toBe(true);
      await api.controls.toggle('radio2');
      expect(await api.controls.isChecked('radio2')).toBe(true);
      expect(await api.controls.isChecked('radio1')).toBe(false);
    });

    test('a toggle button says ON or OFF', async ({ api }) => {
      expect(await api.controls.toggleText('toggle1')).toBe('OFF');
      await api.controls.toggle('toggle1');
      expect(await api.controls.toggleText('toggle1')).toBe('ON');
      expect(await api.controls.isChecked('toggle1')).toBe(true);
    });

    test('the spinner offers the eight planets and shows the one picked', async ({ api }) => {
      expect(await api.controls.planet()).toBe(ControlsScreen.PLANETS[0]);
      await api.controls.pickPlanet('Mars');
      expect(await api.controls.planet()).toBe('Mars');
    });

    test('text typed into a field stays there, and the disabled button cannot be used', async ({ api }) => {
      await api.controls.type('Appium on Android 14');
      expect(await api.controls.text()).toBe('Appium on Android 14');
      expect(await api.controls.isDisabledSaveEnabled()).toBe(false);
    });
  });

  test('a tap along the seek bar sets its value, and the app is told it came from touch', async ({
    app,
    api,
  }) => {
    await app.open(ACTIVITY.seekBar);
    await api.seekBar.waitUntilShown();
    expect(await api.seekBar.value()).toBe(50);

    await api.seekBar.tapAt(0.9);
    await expect.poll(() => api.seekBar.value()).toBeGreaterThanOrEqual(85);
    expect(await api.seekBar.progressText()).toMatch(/^\d+ from touch=true$/);

    await api.seekBar.tapAt(0.1);
    await expect.poll(() => api.seekBar.value()).toBeLessThanOrEqual(15);
  });

  test('tapping the fourth of five stars rates four, and the app reports it', async ({ app, api }) => {
    await app.open(ACTIVITY.ratingBar);
    await api.ratingBar.waitUntilShown();
    await api.ratingBar.rate(4);
    await expect.poll(() => api.ratingBar.ratingText()).toBe('Rating: 4.0/5');
  });
});
