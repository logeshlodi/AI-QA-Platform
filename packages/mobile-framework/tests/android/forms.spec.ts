import { expect, test } from '../../src/fixtures';

test.describe('Form controls', { tag: ['@mobile', '@android'] }, () => {
  test.beforeEach(async ({ screens }) => {
    await screens.nav.open('Forms');
    await screens.forms.waitUntilShown();
  });

  test('typed text reaches the app, and clearing the field clears it', async ({ screens }) => {
    await screens.forms.type('Hello from Appium');
    await expect.poll(() => screens.forms.echoedText()).toBe('Hello from Appium');
    await screens.forms.clearInput();
    await expect.poll(() => screens.forms.echoedText()).toBe('');
  });

  test('the switch turns on and off, and its label says what the next tap will do', async ({ screens }) => {
    expect(await screens.forms.isSwitchOn()).toBe(false);
    expect(await screens.forms.switchLabel()).toBe('Click to turn the switch ON');

    await screens.forms.toggleSwitch();
    await expect.poll(() => screens.forms.isSwitchOn()).toBe(true);
    expect(await screens.forms.switchLabel()).toBe('Click to turn the switch OFF');

    await screens.forms.toggleSwitch();
    await expect.poll(() => screens.forms.isSwitchOn()).toBe(false);
  });

  test('an option picked from the dropdown is the one shown', async ({ screens }) => {
    await screens.forms.choose('Appium is awesome');
    await expect.poll(() => screens.forms.chosen()).toBe('Appium is awesome');
    await screens.forms.choose('webdriver.io is awesome');
    await expect.poll(() => screens.forms.chosen()).toBe('webdriver.io is awesome');
  });

  test('the active button asks a question with three answers, and Cancel closes it', async ({ screens }) => {
    await screens.forms.tapActive();
    await screens.alert.waitUntilShown();
    expect(await screens.alert.title()).toBe('This button is');
    expect(await screens.alert.message()).toBe('This button is active');
    // Android draws dialog buttons in capitals; the app passes 'Ask me later', 'Cancel', 'OK'.
    expect(await screens.alert.buttons()).toEqual(['ASK ME LATER', 'CANCEL', 'OK']);

    await screens.alert.tap('Cancel');
    await expect.poll(() => screens.alert.isShown()).toBe(false);
  });

  // The app disables this button in React Native only: Android still reports it enabled, so a screen
  // reader announces it as usable (an accessibility bug in the app). What the user gets is checked:
  // a tap does nothing.
  test('a tap on the inactive button does nothing', async ({ screens }) => {
    await screens.forms.tapInactive();
    await expect(screens.alert.waitUntilShown(3_000)).rejects.toThrow('No alert appeared');
  });
});
