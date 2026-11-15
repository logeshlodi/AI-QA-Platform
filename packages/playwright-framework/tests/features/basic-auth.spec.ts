import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'theInternet', httpCredentials: { username: 'admin', password: 'admin' } });

// httpCredentials answers the browser's native auth prompt, which no locator can reach.
test('HTTP basic auth through httpCredentials', async ({ page }) => {
  await page.goto(targetUrl('theInternet', '/basic_auth'));
  await expect(page.getByText('Congratulations! You must have the proper credentials.')).toBeVisible();
});
