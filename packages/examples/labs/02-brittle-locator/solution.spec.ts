import { expect, test } from '@playwright/test';

// Lab 02, solved: find the button by what it is (a button) and what it is called, not by its id.

test('the dynamic-id button can be found and clicked on every visit', async ({ page }) => {
  await page.goto('http://www.uitestingplayground.com/dynamicid');
  const button = page.getByRole('button', { name: 'Button with Dynamic ID' });
  const firstId = await button.getAttribute('id');

  await page.reload();
  await expect(button).toBeVisible();
  await expect(button).not.toHaveAttribute('id', firstId ?? ''); // the id did change...
  await button.click(); // ...and the locator did not care
});
