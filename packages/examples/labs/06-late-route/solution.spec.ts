import { expect, test } from '@playwright/test';

// Lab 06, solved: the route is registered before the navigation that makes the request.

const FRUITS = '*/**/api/v1/fruits';

test('shows the fruit from a mocked API', async ({ page }) => {
  await page.route(FRUITS, (route) => route.fulfill({ json: [{ name: 'Jackfruit', id: 21 }] }));
  await page.goto('https://demo.playwright.dev/api-mocking/');

  await expect(page.getByText('Jackfruit')).toBeVisible();
  await expect(page.getByText('Strawberry')).toBeHidden();
});
