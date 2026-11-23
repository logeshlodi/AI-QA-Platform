import { describe, expect, it } from 'vitest';
import { assertionsChanged, HEAL_TASK, scoreHeal, scorePlan } from '../src/commands/compare';

const SNAPSHOT = `- textbox "Username"
- textbox "Password"
- button "Login"`;

const plan = (steps: string[]) => `# Login

## Application Overview

The login page.

## Test Scenarios

### 1. Sign in

#### Steps

${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

#### Expected Results

- The products page opens
`;

describe('scorePlan', () => {
  it('passes a plan whose named elements are on the page', () => {
    const score = scorePlan(
      plan(['Type into "Username"', 'Type into "Password"', 'Click "Login"']),
      SNAPSHOT,
    );
    expect(score).toMatchObject({ scenarios: 1, steps: 3, named: 3, missing: [], passed: true });
  });

  it('fails a plan that invents elements', () => {
    const score = scorePlan(plan(['Click "Sign up"', 'Click "Forgot password"', 'Click "Login"']), SNAPSHOT);
    expect(score.missing).toEqual(['Sign up', 'Forgot password']);
    expect(score.passed).toBe(false);
  });

  it('fails a plan that names nothing', () => {
    expect(scorePlan(plan(['Sign in as the standard user']), SNAPSHOT).passed).toBe(false);
  });
});

describe('assertionsChanged', () => {
  it('ignores spacing but catches an edited or removed assertion', () => {
    const before = "await expect(a).toHaveText('x');\nawait expect(b).toBeVisible();";
    expect(
      assertionsChanged(before, "  await expect(a).toHaveText( 'x');\nawait expect(b).toBeVisible();"),
    ).toEqual(["await expect(a).toHaveText('x');"]);
    expect(
      assertionsChanged(before, "await expect(a).toHaveText('x');\nawait   expect(b).toBeVisible();"),
    ).toEqual([]);
    expect(assertionsChanged(before, "await expect(a).toHaveText('y');")).toHaveLength(2);
  });
});

describe('scoreHeal', () => {
  const healed = HEAL_TASK.replace(
    "page.locator('#btn-1001')",
    "page.getByRole('button', { name: 'Pay now' })",
  );

  it('passes a fix that changes only the locator', () => {
    expect(scoreHeal(healed, true)).toEqual({ locatorChanged: true, assertionsTouched: [], passed: true });
  });

  it('fails a fix that weakens an assertion, even when the test then passes', () => {
    const weakened = healed.replace(".toHaveText('Paid')", '.toBeVisible()');
    const score = scoreHeal(weakened, true);
    expect(score.assertionsTouched).toEqual([
      "await expect(page.locator('form button')).toHaveText('Paid');",
    ]);
    expect(score.passed).toBe(false);
  });

  it('fails the untouched task and a fix that does not run', () => {
    expect(scoreHeal(HEAL_TASK, false).locatorChanged).toBe(false);
    expect(scoreHeal(healed, false).passed).toBe(false);
  });
});
