import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ChatPage } from './chat.page';
import { quarantinedIds } from './quarantine';

// Signed in as the platform admin. Runs after the dashboard project: it switches chat writes off and on.
test.describe.configure({ mode: 'serial' });

test('the admin area shows the model without its key', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' }).click();
  const model = page.getByRole('region', { name: 'Model' });
  await expect(model).toContainText('openai-compatible:stub');
  await expect(model).toContainText('set (not shown)');
  await expect(model).not.toContainText('test-only-not-a-key');
});

test('a change the admin asked for runs only after the admin approves it', async ({ page }) => {
  const chat = new ChatPage(page);
  await chat.open();
  await chat.ask('Please quarantine inventory-sort, it flips every third run');
  await chat.waitForAnswer();
  const card = chat.approvals();
  await expect(card).toContainText('"testId": "inventory-sort"');
  expect(quarantinedIds()).not.toContain('inventory-sort');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card.getByRole('status')).toHaveText('Approved and done: inventory-sort is quarantined');
  expect(quarantinedIds()).toContain('inventory-sort');

  await page.goto('/admin');
  const row = page
    .getByRole('table', { name: /Tests out of the gate/ })
    .getByRole('row', { name: /inventory-sort/ });
  await expect(row).toContainText('Asked for in the chat');
  await expect(row).toContainText('Platform Admin');
  await row.getByRole('button', { name: 'Release inventory-sort' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'back in the gate' })).toBeVisible();
  await expect(page.getByText('No test is quarantined.')).toBeVisible();
  expect(quarantinedIds()).not.toContain('inventory-sort');
});

test('even an admin is asked first when the instruction came from a page', async ({ page }) => {
  const chat = new ChatPage(page);
  await chat.open();
  await chat.ask('Why did the last storefront run fail?');
  await chat.waitForAnswer();
  const card = chat.approvals();
  await expect(card).toContainText('"testId": "checkout-two"');
  await expect(card).toContainText('The page said to');
  expect(quarantinedIds()).not.toContain('checkout-two');
  await card.getByRole('button', { name: 'Refuse' }).click();
  await expect(card.getByRole('status')).toHaveText('Refused: nothing was changed');
  expect(quarantinedIds()).not.toContain('checkout-two');
});

test('with chat changes switched off, the chat cannot even ask', async ({ page }) => {
  await page.goto('/admin');
  const form = page.getByRole('region', { name: 'Chat budget' });
  await form.getByLabel('Model steps per answer (2 to 8)').fill('3');
  await form.getByLabel(/may ask to quarantine/).uncheck();
  await form.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved');
  await expect(form.getByLabel('Model steps per answer (2 to 8)')).toHaveValue('3');

  const chat = new ChatPage(page);
  await chat.open();
  await chat.ask('Please quarantine cart-badge');
  await chat.waitForAnswer();
  await expect(chat.answers().last()).toContainText('switched off');
  await expect(chat.approvals()).toHaveCount(0);

  await page.goto('/admin');
  await form.getByLabel(/may ask to quarantine/).check();
  await form.getByLabel('Model steps per answer (2 to 8)').fill('4');
  await form.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved');
});

test('settings outside their range are not saved', async ({ page }) => {
  await page.goto('/admin');
  const form = page.getByRole('region', { name: 'Chat budget' });
  // The browser stops 99 in a number field with max 8; remove the limit to test the server's own check.
  await form.getByLabel('Model steps per answer (2 to 8)').evaluate((el) => el.removeAttribute('max'));
  await form.getByLabel('Model steps per answer (2 to 8)').fill('99');
  await form.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('Not saved');
  await expect(form.getByLabel('Model steps per answer (2 to 8)')).toHaveValue('4');
});

test('the admin area has no WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto('/admin');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
});
