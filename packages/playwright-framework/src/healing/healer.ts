import type { Locator, Page, TestInfo } from '@playwright/test';
import { formatHealReport, type HealingEngine, type HealRepository } from '@aiqa/self-healing-engine';
import type { HealMode } from '@aiqa/shared';
import { probe } from './probe';

export interface HealerDeps {
  engine: HealingEngine;
  repository: HealRepository;
  mode: HealMode;
  /** How long to wait for the original locator before trying to heal. */
  timeoutMs?: number;
}

/**
 * Adapter between Playwright and the self-healing engine.
 *
 *   const button = await healer.locate('LoginPage.loginButton', page.locator('#login'));
 *
 * When the locator works, its element is fingerprinted for next time.
 * When it does not, the engine looks for the same element on the page and, by mode:
 *   off      rethrow the original error
 *   suggest  fail, with a report and a pasteable fix attached   (default)
 *   runtime  continue this run with the healed locator, and log it
 * Source files are never rewritten. A person reviews the suggested diff.
 */
export class Healer {
  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
    private readonly deps: HealerDeps,
  ) {}

  async locate(locatorKey: string, primary: Locator): Promise<Locator> {
    const { engine, repository, mode } = this.deps;
    const target = primary.first();
    try {
      await target.waitFor({ state: 'attached', timeout: this.deps.timeoutMs ?? 3000 });
    } catch (error) {
      if (mode === 'off') throw error;
      const fingerprint = repository.getFingerprint(locatorKey);
      if (!fingerprint) throw error;

      const elements = await this.page.evaluate(probe, { limit: 400 });
      const decision = await engine.heal({ ...fingerprint, selector: String(primary) }, elements);
      const report = formatHealReport({ ...fingerprint, selector: String(primary) }, decision);

      repository.recordEvent({
        locatorKey,
        testId: this.testInfo.testId,
        failedSelector: String(primary),
        healedSelector: decision.candidate?.element.cssPath,
        strategy: decision.candidate?.strategy ?? 'none',
        score: decision.candidate?.score ?? decision.ranked[0]?.score ?? 0,
        outcome: decision.outcome,
        createdAt: new Date().toISOString(),
      });
      await this.testInfo.attach(`heal-${locatorKey}`, { body: report, contentType: 'text/markdown' });
      this.testInfo.annotations.push({
        type: `heal-${decision.outcome}`,
        description: `${locatorKey}: ${decision.reason}`,
      });

      if (decision.outcome === 'healed' && decision.candidate && mode === 'runtime') {
        return this.page.locator(decision.candidate.element.cssPath);
      }
      const hint = decision.candidate ? ` Suggested fix: ${decision.candidate.suggestion}` : '';
      throw new Error(
        `Locator "${locatorKey}" (${String(primary)}) was not found. ${decision.reason}${hint}`,
        { cause: error },
      );
    }

    const [described] = await target.evaluate(probe, { limit: 1 });
    if (described) {
      repository.saveFingerprint({
        ...described,
        locatorKey,
        selector: String(primary),
        pageUrl: this.page.url(),
        updatedAt: new Date().toISOString(),
      });
    }
    return primary;
  }
}
