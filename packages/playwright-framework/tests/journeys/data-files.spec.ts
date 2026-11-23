import path from 'node:path';
import { readCsv, readYaml } from '@aiqa/test-data-engine';
import { z } from 'zod';
import { expect, test } from '../../src/fixtures';
import type { SortOption } from '../../src/pages/saucedemo/inventory.page';

/**
 * Data-driven tests from files people edit: login cases in CSV (a spreadsheet export), sort orders in
 * YAML (nested, with comments). Each row is checked against a schema when it is read, so a typo fails
 * with the file, case and field named before any browser starts. One generated test per row.
 */
test.use({ targetName: 'saucedemo' });

const DATA = path.join(__dirname, '..', 'data');

const loginCase = z.object({
  case: z.string().min(1),
  username: z.string(),
  password: z.string(),
  outcome: z.enum(['products', 'error']),
  message: z.string(),
});
const sortCase = z.object({
  label: z.string(),
  option: z.enum(['az', 'za', 'lohi', 'hilo']),
  first: z.object({ name: z.string(), price: z.number().positive() }),
  last: z.object({ name: z.string(), price: z.number().positive() }),
});

const logins = readCsv(path.join(DATA, 'logins.csv'), loginCase);

test.describe('logins from logins.csv', { tag: '@journey' }, () => {
  for (const row of logins.filter((r) => r.outcome === 'products')) {
    test(row.case, async ({ loginPage, inventoryPage }) => {
      await loginPage.goto();
      await loginPage.login(row.username, row.password);
      await expect(inventoryPage.title).toHaveText('Products');
    });
  }
  for (const row of logins.filter((r) => r.outcome === 'error')) {
    test(row.case, async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login(row.username, row.password);
      await expect(loginPage.error).toContainText(row.message);
    });
  }
});

test.describe('sort orders from sorting.yaml', { tag: '@journey' }, () => {
  for (const row of readYaml(path.join(DATA, 'sorting.yaml'), sortCase)) {
    test(`sorts by ${row.label}`, async ({ loginFlow, inventoryPage }) => {
      await loginFlow.loginAs('standard');
      await inventoryPage.sortBy(row.option as SortOption);
      await expect(inventoryPage.cards.first()).toContainText(row.first.name);
      await expect(inventoryPage.cards.first()).toContainText(`$${row.first.price}`);
      await expect(inventoryPage.cards.last()).toContainText(row.last.name);
      await expect(inventoryPage.cards.last()).toContainText(`$${row.last.price}`);
    });
  }
});
