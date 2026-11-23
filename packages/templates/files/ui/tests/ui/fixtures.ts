import { test as base } from '@playwright/test';
import { InventoryPage } from './pages/inventory.page';
import { LoginPage } from './pages/login.page';

/** Page objects as fixtures: a spec asks for what it uses, and each test gets fresh ones. */
export const test = base.extend<{ loginPage: LoginPage; inventoryPage: InventoryPage }>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  inventoryPage: async ({ page }, use) => use(new InventoryPage(page)),
});

export { expect } from '@playwright/test';
