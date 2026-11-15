import fs from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { sauceUsers } from '../../src/data/users';
import { LoginPage } from '../../src/pages/saucedemo/login.page';
import { SAUCE_AUTH_FILE, TARGET_STATUS_FILE } from '../../src/paths';

/**
 * Log in once through the UI and save the browser state.
 * Specs that only need "a logged-in user" load this file and skip the login screen,
 * which is faster and keeps login failures out of unrelated tests.
 */
setup('save a logged-in SauceDemo session', async ({ page }) => {
  const status = JSON.parse(fs.readFileSync(TARGET_STATUS_FILE, 'utf8')) as Record<string, boolean>;
  setup.skip(status.saucedemo === false, 'target-down: saucedemo');
  fs.mkdirSync(path.dirname(SAUCE_AUTH_FILE), { recursive: true });
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(sauceUsers.standard);
  await expect(page).toHaveURL(/inventory\.html/);
  await page.context().storageState({ path: SAUCE_AUTH_FILE });
});
