import { namesNotOnPage, parsePlan } from '@aiqa/ai-agents';

/**
 * Scores for comparing Playwright's own test agents (planner, generator, healer in
 * packages/playwright-framework/.claude/agents) with ours, on the same tasks and by the same checks
 * our evals use. The comparison runbook is docs/agents-vs-playwright.md.
 */

export interface PlanScore {
  scenarios: number;
  steps: number;
  /** Quoted element names in the steps ("Add to cart"). */
  named: number;
  /** Quoted names that are not on the page. */
  missing: string[];
  /** Same bar as the planner eval: names something, and at most 20% of the names are not on the page. */
  passed: boolean;
}

export function scorePlan(markdown: string, snapshot: string): PlanScore {
  const plan = parsePlan(markdown);
  const steps = plan.scenarios.flatMap((s) => s.steps);
  const named = steps.join(' ').match(/["'“‘][^"'”’]{2,60}["'”’]/g)?.length ?? 0;
  const missing = namesNotOnPage(steps, snapshot);
  return {
    scenarios: plan.scenarios.length,
    steps: steps.length,
    named,
    missing,
    passed: plan.scenarios.length > 0 && named > 0 && missing.length / named <= 0.2,
  };
}

/** Lines that assert, with spacing normalised, so formatting changes do not count as edits. */
export function assertionLines(code: string): string[] {
  return code
    .split('\n')
    .filter((line) => /\bexpect(\.soft|\.poll)?\s*\(/.test(line))
    .map((line) => line.trim().replace(/\s+/g, ' '));
}

/** Assertions in `before` that are missing or changed in `after`. ADR 0003: a heal never touches one. */
export function assertionsChanged(before: string, after: string): string[] {
  const remaining = assertionLines(after);
  return assertionLines(before).filter((line) => {
    const at = remaining.indexOf(line);
    if (at === -1) return true;
    remaining.splice(at, 1);
    return false;
  });
}

/**
 * The healing task: the same breakage as the Sprint 10 heal-review spec. A generated id changed
 * (btn-1001 became btn-7342), so the spec's locator no longer matches. The page is set with
 * setContent, so no third-party site is involved and every run sees the same page.
 */
export const HEAL_TASK_FILE = 'tests/generated/heal-task.spec.ts';
export const HEAL_TASK = `import { expect, test } from '@playwright/test';

// Healing comparison task (pnpm aiqa agents compare heal-task). The button's generated id changed
// from btn-1001 to btn-7342; fix the test without changing what it checks.
const PAGE = \`<main><h1>Order 42</h1><form>
  <button type="button" id="btn-7342" class="btn primary" onclick="this.textContent='Paid'">Pay now</button>
</form></main>\`;

test('paying marks the order as paid', async ({ page }) => {
  await page.setContent(PAGE);
  await page.locator('#btn-1001').click({ timeout: 3000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Order 42');
  await expect(page.locator('form button')).toHaveText('Paid');
});
`;

export interface HealScore {
  /** The broken locator is gone. */
  locatorChanged: boolean;
  /** Assertions removed or edited (must be none). */
  assertionsTouched: string[];
  passed: boolean;
}

/** Scores a healed task file; `runsPassed` comes from running it. */
export function scoreHeal(healed: string, runsPassed: boolean): HealScore {
  const assertionsTouched = assertionsChanged(HEAL_TASK, healed);
  const locatorChanged = !healed.includes("'#btn-1001'");
  return {
    locatorChanged,
    assertionsTouched,
    passed: runsPassed && locatorChanged && assertionsTouched.length === 0,
  };
}

export function formatPlanScore(file: string, score: PlanScore): string {
  return [
    `${file}: ${score.passed ? 'PASS' : 'FAIL'}`,
    `  ${score.scenarios} scenarios, ${score.steps} steps, ${score.named} named elements`,
    score.missing.length
      ? `  not on the page: ${score.missing.map((m) => `"${m}"`).join(', ')}`
      : '  every named element is on the page',
  ].join('\n');
}
