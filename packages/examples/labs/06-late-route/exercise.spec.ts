import { expect, test } from '@playwright/test';

// Lab 06: read README.md first. This spec has one planted mistake.

const FRUITS = '*/**/api/v1/fruits';

test('shows the fruit from a mocked API', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/api-mocking/');
  await page.route(FRUITS, (route) => route.fulfill({ json: [{ name: 'Jackfruit', id: 21 }] }));

  await expect(page.getByText('Jackfruit')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Strawberry')).toBeHidden();
});
