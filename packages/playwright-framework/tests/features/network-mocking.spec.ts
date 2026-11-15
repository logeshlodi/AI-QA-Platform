import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'apiMocking' });

const FRUITS = '*/**/api/v1/fruits';

test.describe('page.route', () => {
  test('observes the real response', async ({ page }) => {
    const responsePromise = page.waitForResponse(FRUITS);
    await page.goto(targetUrl('apiMocking', '/'));
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(page.getByText('Strawberry')).toBeVisible();
  });

  test('fulfils a request with made-up data', async ({ page }) => {
    await page.route(FRUITS, (route) => route.fulfill({ json: [{ name: 'Jackfruit', id: 1 }] }));
    await page.goto(targetUrl('apiMocking', '/'));
    await expect(page.getByText('Jackfruit')).toBeVisible();
    await expect(page.getByText('Strawberry')).toBeHidden();
  });

  test('modifies the real response on its way to the page', async ({ page }) => {
    await page.route(FRUITS, async (route) => {
      const response = await route.fetch();
      const fruits = (await response.json()) as { name: string; id: number }[];
      await route.fulfill({ response, json: [...fruits, { name: 'Aiqa test fruit', id: 100_000 }] });
    });
    await page.goto(targetUrl('apiMocking', '/'));
    await expect(page.getByText('Aiqa test fruit')).toBeVisible();
    await expect(page.getByText('Strawberry')).toBeVisible();
  });

  test('aborts a request to see how the page copes with a failed API', async ({ page }) => {
    await page.route(FRUITS, (route) => route.abort('failed'));
    await page.goto(targetUrl('apiMocking', '/'));
    await expect(page.getByText('Strawberry')).toBeHidden();
  });
});
