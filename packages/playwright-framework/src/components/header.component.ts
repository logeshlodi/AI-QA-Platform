import type { Locator, Page } from '@playwright/test';

/** The bar shown on every SauceDemo page after login. Written once, reused by all pages. */
export class HeaderComponent {
  readonly cartLink: Locator;
  readonly cartBadge: Locator;
  readonly menuButton: Locator;
  readonly logoutLink: Locator;

  constructor(page: Page) {
    this.cartLink = page.getByTestId('shopping-cart-link').describe('Cart link');
    this.cartBadge = page.getByTestId('shopping-cart-badge').describe('Cart badge');
    this.menuButton = page.getByRole('button', { name: 'Open Menu' }).describe('Menu button');
    this.logoutLink = page.getByTestId('logout-sidebar-link').describe('Logout link');
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }

  async logout(): Promise<void> {
    await this.menuButton.click();
    await this.logoutLink.click();
  }
}
