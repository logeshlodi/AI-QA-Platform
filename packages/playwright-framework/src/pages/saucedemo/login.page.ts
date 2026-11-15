import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';
import { SAUCE_PASSWORD } from '../../data/users';

export class LoginPage extends BasePage {
  protected readonly path = '/';
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByPlaceholder('Username').describe('Username field');
    this.password = page.getByPlaceholder('Password').describe('Password field');
    this.loginButton = page.getByRole('button', { name: 'Login' }).describe('Login button');
    this.error = page.getByTestId('error').describe('Login error banner');
  }

  async login(username: string, password: string = SAUCE_PASSWORD): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}
