import { expect, test } from '../../src/fixtures';
import { ACTIVITY } from '../../src/screens/apidemos';

test.describe('Finding screens in a long native list', { tag: ['@mobile', '@android'] }, () => {
  test('UiScrollable brings an entry far down the Views list on screen', async ({ api }) => {
    await api.home.open('Views');
    await api.home.scrollTo('WebView');
    expect(await api.home.shows('WebView')).toBe(true);
  });

  test('a menu path opens the same screen as starting its activity directly', async ({ app, api }) => {
    await api.home.open('Views');
    await api.home.scrollTo('Seek Bar');
    await api.home.open('Seek Bar');
    await api.seekBar.waitUntilShown();
    expect(await app.activity()).toBe(ACTIVITY.seekBar);

    await app.relaunch();
    await app.open(ACTIVITY.seekBar);
    await api.seekBar.waitUntilShown();
    expect(await app.activity()).toBe(ACTIVITY.seekBar);
  });
});
