import { sauceUsers, type SauceUser } from '../data/users';
import type { LoginPage } from '../pages/saucedemo/login.page';

/** Facade: one call for "be logged in as this kind of user". */
export class LoginFlow {
  constructor(private readonly loginPage: LoginPage) {}

  async loginAs(user: SauceUser = 'standard'): Promise<void> {
    await this.loginPage.goto();
    await this.loginPage.login(sauceUsers[user]);
  }
}
