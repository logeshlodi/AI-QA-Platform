import { HealingEngine, MemoryHealRepository } from '@aiqa/self-healing-engine';
import type { HealMode } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';
import { Healer } from '../../src/healing/healer';

/**
 * Self-healing proven on pages we control, so the result never depends on a
 * third-party site. Each test first records a fingerprint on the "old" page,
 * then loads a "new" page where the original locator no longer matches.
 */
const OLD = `<main><h1>Pay</h1><form><button type="button" id="btn-1001" class="btn primary" onclick="this.textContent='Paid'">Pay now</button></form><a href="#help">Help</a></main>`;
const NEW_ID = OLD.replace('btn-1001', 'btn-7342');
const TWINS = `<main><ul><li><button class="btn primary">Pay now</button></li><li><button class="btn primary">Pay now</button></li></ul></main>`;

test.describe('Healer', () => {
  const setup = async (page: import('@playwright/test').Page, mode: HealMode) => {
    const repository = new MemoryHealRepository();
    const healer = new Healer(page, test.info(), {
      engine: new HealingEngine(),
      repository,
      mode,
      timeoutMs: 500,
    });
    await page.setContent(OLD);
    await healer.locate('PayPage.payButton', page.locator('#btn-1001'));
    return { healer, repository };
  };

  test('records a fingerprint while the locator still works', async ({ page }) => {
    const { repository } = await setup(page, 'suggest');
    expect(repository.getFingerprint('PayPage.payButton')).toMatchObject({
      tag: 'button',
      role: 'button',
      accessibleName: 'Pay now',
      attributes: { id: 'btn-1001', class: 'btn primary' },
      ancestorPath: 'body>main>form>button',
    });
  });

  test('runtime mode: continues with the healed element and logs the heal', async ({ page }) => {
    const { healer, repository } = await setup(page, 'runtime');
    await page.setContent(NEW_ID);

    const healed = await healer.locate('PayPage.payButton', page.locator('#btn-1001'));
    await healed.click();

    await expect(page.getByRole('button', { name: 'Paid' })).toBeVisible();
    expect(repository.listEvents()).toMatchObject([
      { outcome: 'healed', strategy: 'role', locatorKey: 'PayPage.payButton' },
    ]);
    expect(test.info().annotations).toContainEqual(expect.objectContaining({ type: 'heal-healed' }));
  });

  test('suggest mode: fails, but tells you the fix', async ({ page }) => {
    const { healer } = await setup(page, 'suggest');
    await page.setContent(NEW_ID);

    await expect(healer.locate('PayPage.payButton', page.locator('#btn-1001'))).rejects.toThrow(
      "Suggested fix: page.getByRole('button', { name: 'Pay now' })",
    );
    const report = test.info().attachments.find((a) => a.name === 'heal-PayPage.payButton');
    expect(report?.body?.toString()).toContain('# Self-healing: HEALED');
  });

  test('refuses to choose between two identical buttons', async ({ page }) => {
    const { healer, repository } = await setup(page, 'runtime');
    await page.setContent(TWINS);

    await expect(healer.locate('PayPage.payButton', page.locator('#btn-1001'))).rejects.toThrow(
      /Ambiguous: 2 elements/,
    );
    expect(repository.listEvents()).toMatchObject([{ outcome: 'refused' }]);
  });

  test('refuses when the element is really gone', async ({ page }) => {
    const { healer } = await setup(page, 'runtime');
    await page.setContent('<main><a href="#help">Help</a></main>');
    await expect(healer.locate('PayPage.payButton', page.locator('#btn-1001'))).rejects.toThrow(
      /was not found/,
    );
  });

  test('off mode: behaves exactly like plain Playwright', async ({ page }) => {
    const { healer, repository } = await setup(page, 'off');
    await page.setContent(NEW_ID);
    await expect(healer.locate('PayPage.payButton', page.locator('#btn-1001'))).rejects.toThrow(/Timeout/);
    expect(repository.listEvents()).toHaveLength(0);
  });
});
