import { HealingEngine, MemoryHealRepository } from '@aiqa/self-healing-engine';
import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';
import { Healer } from '../../src/healing/healer';

test.use({ targetName: 'uiPlayground' });

// A live page that regenerates a button's id on every load: the classic way an id locator rots.
test('heals an id locator after the live page regenerates the id', async ({ page }) => {
  const repository = new MemoryHealRepository();
  const healer = new Healer(page, test.info(), {
    engine: new HealingEngine(),
    repository,
    mode: 'runtime',
    timeoutMs: 1500,
  });
  const button = page.getByRole('button', { name: 'Button with Dynamic ID' });

  await page.goto(targetUrl('uiPlayground', '/dynamicid'));
  const firstId = await button.getAttribute('id');
  const staleLocator = page.locator(`[id="${firstId}"]`);
  await healer.locate('DynamicIdPage.button', staleLocator);

  await page.reload();
  await expect(button, 'the id must change for this test to mean anything').not.toHaveAttribute(
    'id',
    firstId ?? '',
  );

  const healed = await healer.locate('DynamicIdPage.button', staleLocator);
  await expect(healed).toHaveText('Button with Dynamic ID');
  expect(repository.listEvents()).toMatchObject([{ outcome: 'healed' }]);
});
