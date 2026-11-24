import { expect, test } from '../../src/fixtures';
import { auditPageSource, type A11yIssue } from '../../src/a11y';

// Every tappable element has something for TalkBack to read and is at least 48 x 48 dp, checked
// from each screen's UI tree (src/a11y.ts has the rules).
//
// The demo app is not ours to fix, so the touch targets it already has that are too small are
// listed below, as found on the emulator on 24 Nov (docs/STATUS.md). A new problem fails the test;
// so does one of these going away, so the list stays true.
const KNOWN: Record<string, Pick<A11yIssue, 'rule' | 'element'>[]> = {
  Home: [],
  Login: [
    { rule: 'target-size', element: 'ViewGroup "button-login-container"' }, // the Login tab, 40 dp tall
    { rule: 'target-size', element: 'ViewGroup "button-sign-up-container"' }, // the Sign up tab, 40 dp tall
    { rule: 'target-size', element: 'EditText RNE__Input__text-input' }, // email field, 46 dp tall
    { rule: 'target-size', element: 'EditText RNE__Input__text-input' }, // password field, 46 dp tall
  ],
  Forms: [
    { rule: 'target-size', element: 'EditText RNE__Input__text-input' }, // text field, 40 dp tall
    { rule: 'target-size', element: 'Switch "switch"' }, // 46 x 27 dp
    { rule: 'target-size', element: 'ViewGroup android_touchable_wrapper' }, // the dropdown, 40 dp tall
  ],
  Swipe: [],
  Drag: [{ rule: 'target-size', element: 'ViewGroup "renew"' }], // the reset button, 26 x 27 dp
};

test.describe('Accessibility of the demo app', { tag: ['@mobile', '@android', '@a11y'] }, () => {
  for (const [name, known] of Object.entries(KNOWN)) {
    test(`on the ${name} screen, every control can be read out, and no new control is too small to tap`, async ({
      screens,
      driver,
    }, testInfo) => {
      if (name !== 'Home') await screens.nav.open(name as 'Login' | 'Forms' | 'Swipe' | 'Drag');
      await expect.poll(async () => (await driver.getPageSource()).length).toBeGreaterThan(1_000);
      const density = Number(await driver.getDisplayDensity());
      const issues = auditPageSource(await driver.getPageSource(), density);
      await testInfo.attach('a11y-issues.json', {
        body: JSON.stringify(issues, null, 2),
        contentType: 'application/json',
      });
      expect(issues.map(({ rule, element }) => ({ rule, element }))).toEqual(known);
    });
  }
});
