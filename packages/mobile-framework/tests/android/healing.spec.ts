import { HealingEngine, MemoryHealRepository } from '@aiqa/self-healing-engine';
import { expect, test } from '../../src/fixtures';
import { ScreenHealer, suggestScreenLocator } from '../../src/healing';

// Self-healing on the real screen. The app cannot be renamed from a test, so the test renames the
// locator instead: a screen object that asks for `button-LOG-IN` is what a renamed button looks
// like from the test's side. A private, in-memory heal history keeps the real one clean.

test.describe('Self-healing screen objects', { tag: ['@mobile', '@android', '@healing'] }, () => {
  test('a locator whose ID changed is found again: suggested as a fix, or used for the run', async ({
    screens,
    driver,
  }, testInfo) => {
    await screens.nav.open('Login');
    await screens.login.waitUntilShown();
    const repository = new MemoryHealRepository();
    const engine = new HealingEngine({ suggest: suggestScreenLocator });
    const healer = (mode: 'suggest' | 'runtime') =>
      new ScreenHealer(driver, testInfo, { engine, repository, mode });

    // A passing run fingerprints the button.
    await healer('suggest').locate('LoginScreen.loginButton', 'byId', 'button-LOGIN');
    expect(repository.getFingerprint('LoginScreen.loginButton')).toMatchObject({
      accessibleName: 'button-LOGIN',
      text: 'LOGIN',
    });

    // suggest (the default): the test fails, naming the fix to paste.
    await expect(
      healer('suggest').locate('LoginScreen.loginButton', 'byId', 'button-LOG-IN'),
    ).rejects.toThrow("Suggested fix: byId('button-LOGIN')");
    expect(repository.listEvents()).toMatchObject([
      { locatorKey: 'LoginScreen.loginButton', outcome: 'healed', failedSelector: "byId('button-LOG-IN')" },
    ]);

    // runtime: the run carries on with the element the engine found.
    const button = await healer('runtime').locate('LoginScreen.loginButton', 'byId', 'button-LOG-IN');
    expect(await button.getAttribute('content-desc')).toBe('button-LOGIN');
  });
});
