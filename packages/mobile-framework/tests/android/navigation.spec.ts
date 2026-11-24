import { expect, test } from '../../src/fixtures';
import type { Tab } from '../../src/screens/demo-app';

test.describe('Getting around the demo app', { tag: ['@mobile', '@android'] }, () => {
  test('every tab in the bottom bar opens its own screen', async ({ screens }) => {
    const tabs: [Tab, { isShown(): Promise<boolean> }][] = [
      ['Login', screens.login],
      ['Forms', screens.forms],
      ['Swipe', screens.swipe],
      ['Drag', screens.drag],
      ['Home', screens.home],
    ];
    for (const [tab, screen] of tabs) {
      await screens.nav.open(tab);
      await expect.poll(() => screen.isShown(), { message: `${tab} tab` }).toBe(true);
    }
  });

  test('the side menu reaches the screens that are not in the tab bar', async ({ screens }) => {
    await screens.nav.openFromMenu('permissions');
    await expect.poll(() => screens.permissions.isShown()).toBe(true);
    await expect.poll(() => screens.nav.isMenuOpen()).toBe(false);

    await screens.nav.openFromMenu('data-management');
    await expect.poll(() => screens.data.isShown()).toBe(true);
  });

  test('Android back from a tab returns to the home screen', async ({ screens }) => {
    await screens.nav.open('Forms');
    await screens.forms.waitUntilShown();
    await screens.nav.back();
    await expect.poll(() => screens.home.isShown()).toBe(true);
  });
});
