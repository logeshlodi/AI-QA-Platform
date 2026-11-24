import { expect, test } from '../../src/fixtures';

// The shade belongs to Android's System UI. The notification is posted from Android's shell, because
// ApiDemos' own ones are blocked on Android 13+ (it targets SDK 33 without POST_NOTIFICATIONS).

// A fresh order number per run, so a notification left over from an earlier run can't pass the check.
const ORDER = String(Date.now()).slice(-6);
const TITLE = `Order ${ORDER} shipped`;

test.describe('The notification shade', { tag: ['@mobile', '@android'] }, () => {
  test.afterEach(async ({ api }) => {
    await api.shade.close();
  });

  test('a posted notification shows in the shade, and swiping it away removes it', async ({ api }) => {
    await api.shade.post(`aiqa-order-${ORDER}`, TITLE, 'Arriving Thursday');
    await api.shade.open();
    await expect.poll(() => api.shade.has(TITLE)).toBe(true);

    await api.shade.dismiss(TITLE);
    await expect.poll(() => api.shade.has(TITLE)).toBe(false);
  });
});
