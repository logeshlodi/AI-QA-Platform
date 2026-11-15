import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

// For inputs that have no label at all, the placeholder is what the user sees.
test('getByPlaceholder finds unlabelled inputs', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill('standard_user');
  await expect(page.getByPlaceholder('Username')).toHaveValue('standard_user');
  await expect(page.getByPlaceholder('Password')).toHaveAttribute('type', 'password');
});
