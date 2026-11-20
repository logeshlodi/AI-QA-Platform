import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  applyLocatorPatch,
  HealingEngine,
  MemoryHealRepository,
  proposeLocatorPatch,
  readPatchableSources,
} from '@aiqa/self-healing-engine';
import { expect, test } from '../../src/fixtures';
import { Healer } from '../../src/healing/healer';

/**
 * Sprint 10 gate, second half: a seeded breakage becomes a patch that applies, and the patched page
 * object then works. Everything runs on pages set with setContent, so no third-party site is involved.
 */
const OLD = `<main><form><button type="button" id="btn-1001" class="btn primary" onclick="this.textContent='Paid'">Pay now</button></form></main>`;
const NEW = OLD.replace('btn-1001', 'btn-7342');

const PAGE_OBJECT = `import type { Page } from '@playwright/test';

export class PayPage {
  constructor(private readonly page: Page) {}

  readonly payButton = () => this.page.locator('#btn-1001');
}
`;

test('a healed locator becomes a reviewable patch that makes the page object work again', async ({
  page,
}) => {
  // A copy of a page object in this test's own output folder: the repository is never touched.
  const root = test.info().outputPath('workspace');
  const file = path.join(root, 'src', 'pages', 'pay.page.ts');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PAGE_OBJECT);

  const repository = new MemoryHealRepository();
  const healer = new Healer(page, test.info(), {
    engine: new HealingEngine(),
    repository,
    mode: 'suggest',
    timeoutMs: 500,
  });
  await page.setContent(OLD);
  await healer.locate('PayPage.payButton', page.locator('#btn-1001'));

  // The product changes the generated id: the old locator fails, the engine suggests a fix.
  await page.setContent(NEW);
  await expect(healer.locate('PayPage.payButton', page.locator('#btn-1001'))).rejects.toThrow(
    /Suggested fix/,
  );
  const [event] = repository.listEvents();
  expect(event).toMatchObject({
    outcome: 'healed',
    suggestion: "page.getByRole('button', { name: 'Pay now' })",
  });

  const proposal = proposeLocatorPatch(event!, readPatchableSources(root));
  expect(proposal.status, proposal.status === 'refused' ? proposal.reason : '').toBe('ready');
  if (proposal.status !== 'ready') return;
  await test.info().attach('locator.patch', { body: proposal.diff, contentType: 'text/x-diff' });
  applyLocatorPatch(root, proposal.patch);

  const { PayPage } = (await import(pathToFileURL(file).href)) as typeof import('./pay.page.example');
  await new PayPage(page).payButton().click();
  await expect(page.getByRole('button', { name: 'Paid' })).toBeVisible();
});
