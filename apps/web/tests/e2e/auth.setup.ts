import { expect, test as setup } from '@playwright/test';
import { KeycloakLoginPage } from './keycloak.page';
import { USERS, VIEWER_STATE } from './users';

// Signs in once through Keycloak; the dashboard specs reuse the session cookie.
setup('sign in as the dashboard viewer', async ({ page }) => {
  await page.goto('/');
  await new KeycloakLoginPage(page).signIn(USERS.viewer);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.context().storageState({ path: VIEWER_STATE });
});
