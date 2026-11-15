import { expect, test } from '../src/fixtures';

/**
 * Seed for the Playwright test agents (planner, generator, healer) in .claude/agents.
 * The agents run this first, so every plan and generated test starts from a logged-in
 * SauceDemo session and uses this project's fixtures instead of raw `page` calls.
 */
test.use({ targetName: 'saucedemo' });

test.describe('SauceDemo', () => {
  test('seed', async ({ loginFlow, inventoryPage }) => {
    await loginFlow.loginAs('standard');
    await expect(inventoryPage.title).toHaveText('Products');
  });
});
