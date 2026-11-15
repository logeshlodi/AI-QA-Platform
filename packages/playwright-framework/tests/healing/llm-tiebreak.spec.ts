import { createProvider } from '@aiqa/ai-engine';
import { HealingEngine, LlmStrategy, MemoryHealRepository } from '@aiqa/self-healing-engine';
import { expect, test } from '../../src/fixtures';
import { Healer } from '../../src/healing/healer';

/**
 * The one case rules cannot solve: several elements that are identical in every
 * attribute. Rules refuse (see healer-local.spec.ts). A local model can read the
 * text AROUND each button and pick the right card.
 *
 * Runs only with AI_ENABLED=true and the configured Ollama model pulled; otherwise it skips.
 */
const card = (id: string, name: string, price: string) =>
  `<li class="card"><h3>${name}</h3><p>${price}</p><button type="button" id="${id}" class="btn" onclick="this.closest('li').dataset.added='yes'">Add to cart</button></li>`;

const BEFORE = `<ul>${card('add-1', 'Sauce Labs Backpack', '$29.99')}${card('add-2', 'Sauce Labs Bike Light', '$9.99')}${card('add-3', 'Sauce Labs Onesie', '$7.99')}</ul>`;
// After a redesign: ids regenerated AND the cards reordered, so neither id nor position helps.
const AFTER = `<ul>${card('x-91', 'Sauce Labs Onesie', '$7.99')}${card('x-92', 'Sauce Labs Backpack', '$29.99')}${card('x-93', 'Sauce Labs Bike Light', '$9.99')}</ul>`;

test('a local model picks the right button among three identical ones', async ({ page, env }) => {
  const provider = createProvider(env);
  test.skip(
    !env.AI_ENABLED || !(await provider.isAvailable()),
    'needs AI_ENABLED=true and the Ollama model pulled',
  );
  test.setTimeout(env.OLLAMA_TIMEOUT_MS + 60_000); // a CPU-only laptop needs time to load the model

  const repository = new MemoryHealRepository();
  const engine = new HealingEngine({ tieBreaker: new LlmStrategy(provider) });
  const healer = new Healer(page, test.info(), { engine, repository, mode: 'runtime', timeoutMs: 500 });

  await page.setContent(BEFORE);
  await healer.locate('Inventory.addBikeLight', page.locator('#add-2'));

  await page.setContent(AFTER);
  const healed = await healer.locate('Inventory.addBikeLight', page.locator('#add-2'));
  await healed.click();

  await expect(page.locator('li[data-added="yes"]')).toHaveCount(1);
  await expect(page.locator('li[data-added="yes"] h3')).toHaveText('Sauce Labs Bike Light');
  expect(repository.listEvents()).toMatchObject([{ outcome: 'healed', strategy: 'llm' }]);
});
