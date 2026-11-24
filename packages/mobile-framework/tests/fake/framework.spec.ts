import { attachEvidence } from '../../src/evidence';
import { expect, test } from '../../src/fixtures';

// The framework's plumbing against Appium's fake driver: a real Appium server and a real
// WebdriverIO session, with a pretend app (fixtures/fake-app.xml) instead of a phone. If these pass,
// a failure on the emulator is about the app or the device, not the framework.

test.describe('The mobile framework, on Appium fake driver', { tag: '@mobile' }, () => {
  test('starts its own Appium server from the pinned packages and opens a W3C session', async ({
    appium,
    driver,
  }) => {
    const status = (await (await fetch(`${appium.url}/status`)).json()) as {
      value: { build: { version: string } };
    };
    expect(status.value.build.version).toBe('4.0.1');
    expect(driver.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    // WebdriverIO 10 only speaks W3C; the server returns the capabilities it accepted.
    expect(driver.capabilities).toMatchObject({ platformName: 'Fake' });
  });

  test('finds elements by accessibility ID and types into them', async ({ driver }) => {
    const email = driver.$('~input-email');
    await email.setValue('qa@example.com');
    expect(await email.getText()).toBe('qa@example.com');
  });

  test('refuses a selector that matches more than one element, and $$ returns them all', async ({
    driver,
  }) => {
    await expect(driver.$('~product').getText()).rejects.toThrow(/resolved to 3 elements/);
    expect(await driver.$$('~product').length).toBe(3);
  });

  test('reads element state: a disabled button and a hidden one', async ({ driver }) => {
    expect(await driver.$('~button-Inactive').isEnabled()).toBe(false);
    expect(await driver.$('~button-Hidden').isDisplayed()).toBe(false);
    expect(await driver.$('~button-LOGIN').isDisplayed()).toBe(true);
  });

  test('handles an alert the app raises: reads it, accepts it, and it is gone', async ({ driver }) => {
    await driver.$('~button-LOGIN').click();
    expect(await driver.getAlertText()).toBe('You are logged in!');
    await driver.acceptAlert();
    await expect(driver.getAlertText()).rejects.toThrow();
  });

  test('lists the native and web contexts, and reads the web view after switching to it', async ({
    driver,
  }) => {
    const contexts = (await driver.getContexts()) as string[];
    expect(contexts).toEqual(expect.arrayContaining(['NATIVE_APP', 'WEBVIEW_1']));
    await driver.switchContext('WEBVIEW_1');
    expect(await driver.getTitle()).toBe('Help');
    await driver.switchContext('NATIVE_APP');
    expect(await driver.getContext()).toBe('NATIVE_APP');
  });

  test('sends a touch gesture as W3C pointer actions', async ({ driver }) => {
    await driver
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: 200, y: 700 })
      .down()
      .pause(100)
      .move({ x: 200, y: 300, duration: 300 })
      .up()
      .perform();
    // The fake driver accepts the sequence; on Android the same call scrolls (see swipe.spec.ts).
    expect(await driver.$('~products').isDisplayed()).toBe(true);
  });

  test('attaches what it can on failure and names what it could not', async ({
    driver,
    appium,
  }, testInfo) => {
    const result = await attachEvidence(testInfo, { driver, serverLog: () => appium.tail(50) });
    expect(result.attached).toEqual(expect.arrayContaining(['page-source.xml', 'appium.log']));
    const names = testInfo.attachments.map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(result.attached));
    // Whatever the fake driver cannot give (a device log, say) is recorded with the reason.
    expect(names.includes('evidence-notes.json')).toBe(Object.keys(result.unavailable).length > 0);
  });
});
