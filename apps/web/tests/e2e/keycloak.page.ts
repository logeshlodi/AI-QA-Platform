import { expect, type Page } from '@playwright/test';
import { ISSUER } from './users';

/** Keycloak's login page, as the `aiqa` realm serves it. */
export class KeycloakLoginPage {
  constructor(private readonly page: Page) {}

  readonly username = () => this.page.getByLabel('Username or email');
  readonly password = () => this.page.getByLabel('Password', { exact: true });
  readonly submit = () => this.page.getByRole('button', { name: 'Sign In' });

  async expectShown() {
    // The first form is served from .../protocol/openid-connect/auth; after a failed attempt Keycloak
    // serves it again from .../login-actions/authenticate.
    const realm = ISSUER.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    await expect(this.page).toHaveURL(new RegExp(`^${realm}/(protocol/openid-connect/auth|login-actions/)`));
    await expect(this.username()).toBeVisible();
  }

  async signIn(user: { username: string; password: string }) {
    await this.expectShown();
    await this.username().fill(user.username);
    await this.password().fill(user.password);
    await this.submit().click();
  }
}
