import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.describe('cookies', () => {
  test.use({ targetName: 'saucedemo' });

  test('login sets a session cookie; clearing it logs the user out', async ({
    context,
    loginFlow,
    page,
    loginPage,
  }) => {
    await loginFlow.loginAs('standard');
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'session-username')?.value).toBe('standard_user');

    await context.clearCookies({ name: 'session-username' });
    await page.goto('/inventory.html');
    await expect(loginPage.error).toContainText(
      "You can only access '/inventory.html' when you are logged in",
    );
  });
});

test.describe('local storage', () => {
  test.use({ targetName: 'todomvc' });

  test('todos are kept in localStorage and survive a reload', async ({ page }) => {
    await page.goto(targetUrl('todomvc', '/'));
    await page.getByPlaceholder('What needs to be done?').fill('persist me');
    await page.keyboard.press('Enter');

    const stored = await page.evaluate(
      () => JSON.parse(localStorage.getItem('react-todos') ?? '[]') as { title: string }[],
    );
    expect(stored.map((t) => t.title)).toEqual(['persist me']);

    await page.reload();
    await expect(page.getByText('persist me')).toBeVisible();
  });
});
