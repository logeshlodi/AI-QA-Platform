import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet' });

test('first, last, nth, count and all on a table', async ({ page }) => {
  await page.goto(targetUrl('theInternet', '/tables'));
  const rows = page.locator('#table1 tbody tr');

  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText('Smith');
  await expect(rows.nth(1)).toContainText('Bach');
  await expect(rows.last()).toContainText('Conway');

  // all() returns a snapshot array: use it only after the list has finished loading.
  const emails = await Promise.all((await rows.all()).map((row) => row.locator('td').nth(2).innerText()));
  expect(emails).toHaveLength(4);
  expect(emails.every((email) => email.includes('@'))).toBe(true);
});
