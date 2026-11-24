import { expect, test } from '../../src/fixtures';

test.describe('Deep links', { tag: ['@mobile', '@android'] }, () => {
  test('a wdio:// link opens the screen it names, without going through Home', async ({ app, screens }) => {
    await app.deepLink('wdio://forms');
    await screens.forms.waitUntilShown();
    await app.deepLink('wdio://drag');
    await screens.drag.waitUntilShown();
    expect(await screens.forms.isShown()).toBe(false);
  });
});
