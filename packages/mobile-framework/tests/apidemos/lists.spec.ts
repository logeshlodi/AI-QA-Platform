import { expect, test } from '../../src/fixtures';
import { ACTIVITY } from '../../src/screens/apidemos';

test.describe('Tabs and long lists', { tag: ['@mobile', '@android'] }, () => {
  test('each tab shows its own content', async ({ app, api }) => {
    await app.open(ACTIVITY.tabs);
    await api.tabs.waitUntilShown();
    expect(await api.tabs.showing()).toBe('tab1');

    await api.tabs.open(2);
    await expect.poll(() => api.tabs.showing()).toBe('tab2');
    await api.tabs.open(3);
    await expect.poll(() => api.tabs.showing()).toBe('tab3');
    await api.tabs.open(1);
    await expect.poll(() => api.tabs.showing()).toBe('tab1');
  });

  test('a fling carries the list further than a scroll, and flinging back reaches the top', async ({
    app,
    api,
  }) => {
    await app.open(ACTIVITY.cheeseList);
    await api.cheeseList.waitUntilShown();
    const top = await api.cheeseList.firstVisible();
    expect(top).toBe('Abbaye de Belloc');

    await api.cheeseList.scroll('down');
    const afterScroll = await api.cheeseList.firstVisible();
    await api.cheeseList.scroll('up', 1);
    await expect.poll(() => api.cheeseList.firstVisible()).toBe(top);

    await api.cheeseList.fling('down');
    // The list is sorted, so how far it went shows in the first visible name.
    await expect.poll(() => api.cheeseList.firstVisible()).not.toBe(top);
    expect((await api.cheeseList.firstVisible()).localeCompare(afterScroll)).toBeGreaterThan(0);

    for (let i = 0; i < 20 && (await api.cheeseList.fling('up')); i++);
    await expect.poll(() => api.cheeseList.firstVisible()).toBe(top);
  });
});
