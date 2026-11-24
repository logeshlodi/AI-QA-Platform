import { expect, test } from '../../src/fixtures';
import { ACTIVITY, waitForToast } from '../../src/screens/apidemos';

test.describe('Menus, long press and toasts', { tag: ['@mobile', '@android'] }, () => {
  test('a popup menu lists its items, and picking one confirms with a toast', async ({
    app,
    api,
    driver,
  }) => {
    await app.open(ACTIVITY.popupMenu);
    await api.popupMenu.waitUntilShown();
    await api.popupMenu.openMenu();
    // Share is not here: it sits in a submenu under Edit (see the next test).
    await expect.poll(() => api.popupMenu.menuItems()).toEqual(['Search', 'Add', 'Edit']);

    await api.popupMenu.choose('Add');
    await waitForToast(driver, 'Clicked popup menu item Add');
  });

  test('a menu item with a submenu opens it, and its item is the one confirmed', async ({
    app,
    api,
    driver,
  }) => {
    await app.open(ACTIVITY.popupMenu);
    await api.popupMenu.waitUntilShown();
    await api.popupMenu.openMenu();
    await api.popupMenu.choose('Edit');
    // A submenu repeats its parent's name as its header, with the same ID as the items.
    await expect.poll(() => api.popupMenu.menuItems()).toEqual(['Edit', 'Share']);
    await api.popupMenu.choose('Share');
    await waitForToast(driver, 'Clicked popup menu item Share');
  });

  test('a long press on a list item opens its context menu', async ({ app, api, driver }) => {
    await app.open(ACTIVITY.expandableList);
    await api.expandableList.waitUntilShown();
    await api.expandableList.expand('People Names');
    await expect.poll(() => api.expandableList.isShowing('Arnold')).toBe(true);

    await api.expandableList.longPress('Barry');
    await expect.poll(() => api.expandableList.showsMenuHeader('Sample menu')).toBe(true);
    await api.expandableList.chooseMenuItem('Sample action');
    await waitForToast(driver, 'Barry: Child 1 clicked in group 0');
  });

  test('a short toast shows its message', async ({ app, api, driver }) => {
    await app.open(ACTIVITY.toast);
    await api.toast.waitUntilShown();
    await api.toast.showShort();
    expect(await waitForToast(driver, 'Short notification')).toBe('Short notification');
  });
});
