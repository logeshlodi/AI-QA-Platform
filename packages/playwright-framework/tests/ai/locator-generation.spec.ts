import { createProvider, generateLocator } from '@aiqa/ai-engine';
import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures';

type Role = Parameters<Page['getByRole']>[0];

test.use({ targetName: 'saucedemo' });

/**
 * Locator generation: describe an element in words, get a getByRole locator back.
 * The candidates come from the page's aria snapshot, so the suggestion always
 * points at something that exists and is unique. Simple descriptions are solved
 * by rules; a local model is consulted only when AI_ENABLED=true and rules cannot decide.
 */
test.describe('locator generation from an aria snapshot', { tag: '@ai' }, () => {
  test('suggests a locator for a described element, and the locator works', async ({
    page,
    env,
    loginPage,
  }) => {
    await page.goto('/');
    const snapshot = await page.locator('body').ariaSnapshot();

    const suggestion = await generateLocator(createProvider(env), snapshot, 'the Login button');
    expect(suggestion).toMatchObject({ role: 'button', name: 'Login', source: 'rules' });
    expect(suggestion?.code).toBe('page.getByRole("button", { name: "Login", exact: true })');

    // Prove the suggestion is usable: click it with empty fields and read the validation message.
    await page.getByRole(suggestion!.role as Role, { name: suggestion!.name, exact: true }).click();
    await expect(loginPage.error).toContainText('Username is required');
  });

  test('declines instead of guessing when nothing on the page fits', async ({ page, env }) => {
    test.skip(env.AI_ENABLED, 'with a model switched on the answer is its choice, not a rule');
    await page.goto('/');
    const snapshot = await page.locator('body').ariaSnapshot();
    expect(await generateLocator(createProvider(env), snapshot, 'the Checkout button')).toBeUndefined();
  });
});
