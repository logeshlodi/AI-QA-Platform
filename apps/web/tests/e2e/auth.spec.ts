import { expect, test } from '@playwright/test';
import { KeycloakLoginPage } from './keycloak.page';
import { USERS } from './users';

test.describe('signing in and out through Keycloak', () => {
  test('a page asked for while signed out opens after signing in', async ({ page }) => {
    await page.goto('/flaky');
    await new KeycloakLoginPage(page).signIn(USERS.viewer);
    await expect(page).toHaveURL('/flaky');
    await expect(page.getByRole('heading', { name: 'Flaky tests' })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText(`Signed in as ${USERS.viewer.name}`);
  });

  test('a wrong password stays on Keycloak and opens nothing', async ({ page }) => {
    await page.goto('/');
    const login = new KeycloakLoginPage(page);
    await login.signIn({ username: USERS.viewer.username, password: 'not-the-password' });
    await expect(page.getByText('Invalid username or password.')).toBeVisible();
    await login.expectShown();
  });

  test('signing out ends the Keycloak session too', async ({ page }) => {
    await page.goto('/');
    await new KeycloakLoginPage(page).signIn(USERS.viewer);
    await page.getByRole('link', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/signed-out');
    await expect(page.getByRole('heading', { name: 'You are signed out' })).toBeVisible();
    expect((await page.context().cookies()).map((c) => c.name)).not.toContain('aiqa_session');
    // Keycloak asks for the password again: its own session ended as well.
    await page.getByRole('link', { name: 'Sign in' }).click();
    await new KeycloakLoginPage(page).expectShown();
  });

  test('an account without the dashboard role sees "no access", not data', async ({ page }) => {
    await page.goto('/runs');
    await new KeycloakLoginPage(page).signIn(USERS.noAccess);
    await expect(page).toHaveURL('/no-access');
    await expect(page.getByRole('heading', { name: 'No access to the dashboard' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('dashboard-viewer');
    await page.goto('/runs/ui-08');
    await expect(page).toHaveURL('/no-access');
  });

  test('the return address after sign-in cannot point to another site', async ({ page }) => {
    await page.goto('/auth/login?returnTo=//evil.example/steal');
    await new KeycloakLoginPage(page).signIn(USERS.viewer);
    await expect(page).toHaveURL('/');
  });

  test('a changed session cookie counts as no session', async ({ page, context }) => {
    await page.goto('/');
    await new KeycloakLoginPage(page).signIn(USERS.viewer);
    const session = (await context.cookies()).find((c) => c.name === 'aiqa_session')!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe('Lax');
    await context.addCookies([{ ...session, value: session.value.slice(0, -4) + 'AAAA' }]);
    await page.goto('/heals');
    // The app does not trust the cookie and sends the browser to Keycloak (already signed in there, so it comes straight back).
    await expect(page).toHaveURL('/heals');
    const renewed = (await context.cookies()).find((c) => c.name === 'aiqa_session')!;
    expect(renewed.value).not.toBe(session.value.slice(0, -4) + 'AAAA');
  });

  test('a sign-in started in another tab or long ago is refused', async ({ page }) => {
    await page.goto('/auth/callback?code=made-up&state=made-up');
    await expect(page).toHaveURL('/signed-out?error=sign-in-expired');
    // Scoped to main: Next.js keeps an empty role=alert route announcer on every page.
    await expect(page.getByRole('main').getByRole('alert')).toContainText('took too long');
  });

  test('pages send the security headers', async ({ request }) => {
    const response = await request.get('/signed-out');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });
});
