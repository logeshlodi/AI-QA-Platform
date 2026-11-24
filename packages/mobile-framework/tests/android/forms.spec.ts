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
    expect(await screens.alert.buttons()).toEqual(['Ask me later', 'Cancel', 'OK']);

    await screens.alert.tap('Cancel');
    await expect.poll(() => screens.alert.isShown()).toBe(false);
  });

  test('the inactive button is disabled and a tap on it does nothing', async ({ screens }) => {
    expect(await screens.forms.isInactiveEnabled()).toBe(false);
    await screens.forms.tapInactive();
    expect(await screens.alert.isShown()).toBe(false);
  });
});
