import { describe, expect, it } from 'vitest';
import { formatReviewMarkdown, MemoryRunLog, REVIEW_RULE_IDS, reviewByRules, reviewSpec } from '../src';
import { scriptedModel } from './mock';

const SPEC = 'packages/playwright-framework/tests/journeys/pay.spec.ts';
const rulesOn = (text: string, file = SPEC) => reviewByRules(file, text).map((f) => `${f.line}:${f.rule}`);

describe('spec review: rules', () => {
  it('reports each standard it breaks, with the line', () => {
    const text = [
      "import { expect, test } from '@playwright/test';", // 1 fixtures-import
      "test('test 1', async ({ page }) => {", // 2 title
      '  await page.waitForTimeout(2000);', // 3 fixed wait
      "  await page.locator('//button').first().click();", // 4 xpath, raw locator, position
      "  const apiKey = 'sk-live-0123456789abcdef';", // 5 token
      "  await page.getByRole('button', { name: 'Pay' }).click({ force: true });", // 6 force
      "  if (await page.getByText('Promo').isVisible()) await page.getByText('Close').click();", // 7 branch
      '  console.log("paid");', // 8
      '});',
    ].join('\n');
    expect(rulesOn(text)).toEqual([
      '1:fixtures-import',
      '2:title-says-what-user-gets',
      '3:no-fixed-wait',
      '4:no-xpath',
      '4:position-needs-reason',
      '4:raw-locator-in-journey',
      '5:no-literal-token',
      '6:no-force',
      '7:no-visibility-branch',
      '8:no-console',
    ]);
  });

  it('passes a spec written to the standards', () => {
    const text = [
      "import { expect, test } from '../../src/fixtures';",
      "test('a customer pays and sees the receipt', async ({ payPage }) => {",
      "  await payPage.payWith('visa');",
      "  await expect(payPage.receipt).toContainText('Paid');",
      '  // Sorted by price: the first row is the cheapest, which is the point.',
      '  await expect(payPage.rows.first()).toContainText("$7.99");',
      '});',
    ].join('\n');
    expect(rulesOn(text)).toEqual([]);
  });

  it('skips a line that says why it breaks a rule, and a rule switched off for the file', () => {
    const line = [
      "test('the slow server is flagged', async ({ page }) => {",
      '  // review-ok: the server is slow on purpose',
      '  await page.waitForTimeout(400);',
      '});',
    ].join('\n');
    expect(rulesOn(line)).toEqual([]);
    const file = [
      '// review-ok-file: no-xpath — shows what XPath does',
      "test('XPath reads a table row', async ({ page }) => {",
      "  await expect(page.locator('xpath=//tr[1]')).toBeVisible();",
      '});',
    ].join('\n');
    expect(rulesOn(file, 'packages/playwright-framework/tests/locators/xpath.spec.ts')).toEqual([]);
  });

  it('does not take a reason without words, or a // inside a string, as an opt-out', () => {
    expect(
      rulesOn(
        "test('waits for the toast', async ({ page }) => {\n  await page.waitForTimeout(1); // review-ok:\n});",
      ),
    ).toContain('2:no-fixed-wait');
  });

  it('checks page objects for assertions, and leaves other files alone', () => {
    const po =
      "export class PayPage {\n  async pay() {\n    await expect(this.total).toHaveText('$9');\n  }\n}";
    expect(rulesOn(po, 'packages/playwright-framework/src/pages/pay.page.ts')).toEqual(['3:assert-in-specs']);
    expect(rulesOn('await page.waitForTimeout(1);', 'packages/shared/src/x.ts')).toEqual([]);
  });

  it('accepts an API test named after its endpoint, and a placeholder that is not a secret', () => {
    const text = [
      "test('GET /health', async ({ request }) => {",
      "  const token = 'opaque-token-for-the-fake-session';",
      '});',
    ].join('\n');
    expect(rulesOn(text, 'packages/data-framework/tests/http/health.spec.ts')).toEqual([]);
  });

  it('checks mobile specs and screen objects: no pause, no raw locator, XPath only with a reason', () => {
    const spec = [
      "test('a stopped app starts again', async ({ driver }) => {",
      '  await driver.pause(2000);',
      "  await driver.$('~Login').click();",
      "  await driver.$('//android.widget.Button').click();",
      '});',
    ].join('\n');
    expect(rulesOn(spec, 'packages/mobile-framework/tests/android/x.spec.ts')).toEqual([
      '2:no-fixed-wait',
      '3:raw-locator-in-mobile-spec',
      '4:mobile-xpath-needs-reason',
      '4:raw-locator-in-mobile-spec',
    ]);
    const screen = [
      'export class Toasts {',
      '  // A toast has no ID; only XPath can name it.',
      '  toast = () => this.driver.$(`//android.widget.Toast`);',
      '  other = () => this.driver.$(`//android.widget.Button`);',
      '}',
    ];
    expect(rulesOn(screen.join('\n'), 'packages/mobile-framework/src/screens/toasts.ts')).toEqual([]);
    expect(
      rulesOn(screen.filter((_, i) => i !== 1).join('\n'), 'packages/mobile-framework/src/screens/toasts.ts'),
    ).toEqual(['2:mobile-xpath-needs-reason', '3:mobile-xpath-needs-reason']);
  });

  it('has an id for every rule, all distinct', () => {
    expect(new Set(REVIEW_RULE_IDS).size).toBe(REVIEW_RULE_IDS.length);
  });
});

describe('spec review: the model', () => {
  const text = [
    "import { expect, test } from '../../src/fixtures';",
    "test('a refund is refused after 30 days', async ({ refundPage }) => {",
    "  await refundPage.request('ORD-1');",
    '  await expect(refundPage.form).toBeVisible();',
    '  await page.waitForTimeout(500);',
    '});',
  ].join('\n');

  it('adds judgement calls on real lines, and drops ones on missing lines or lines a rule reported', async () => {
    const model = scriptedModel([
      {
        answer: {
          findings: [
            {
              check: 'title-matches-test',
              line: 2,
              severity: 'should',
              message: 'The title says refused after 30 days, but the test never checks a refusal.',
            },
            {
              check: 'weak-assertion',
              line: 5,
              severity: 'should',
              message: 'Line five is already a rule finding.',
            },
            {
              check: 'unclear-step',
              line: 99,
              severity: 'consider',
              message: 'There is no line ninety-nine.',
            },
          ],
        },
      },
    ]);
    const log = new MemoryRunLog();
    const review = await reviewSpec(SPEC, text, { model: { model: model.model, label: 'mock' }, log });
    expect(review.findings.map((f) => `${f.line}:${f.source}:${f.rule}`)).toEqual([
      '2:model:title-matches-test',
      '5:rules:no-fixed-wait',
    ]);
    expect(review.modelNote).toContain('2 model finding(s) dropped');
    expect(JSON.stringify(model.prompts[0])).toContain('already-found');
    expect(log.records[0]).toMatchObject({ agent: 'review', source: 'model' });
  });

  it('keeps the rule findings when the model fails, and never asks it about a page object', async () => {
    const failing = scriptedModel([{ fail: 'timeout' }]);
    const review = await reviewSpec(SPEC, text, { model: { model: failing.model, label: 'mock' } });
    expect(review.findings.map((f) => f.rule)).toEqual(['no-fixed-wait']);
    expect(review.modelNote).toContain('model failed');

    const unused = scriptedModel([{ answer: { findings: [] } }]);
    await reviewSpec('packages/playwright-framework/src/pages/pay.page.ts', 'export class PayPage {}', {
      model: { model: unused.model, label: 'mock' },
    });
    expect(unused.calls()).toBe(0);
  });

  it('writes a pull-request comment that leads with what must be fixed', async () => {
    const review = await reviewSpec(SPEC, text);
    const md = formatReviewMarkdown([review, { file: 'clean.spec.ts', findings: [] }]);
    expect(md).toContain('### Spec review: 1 finding(s), 1 to fix before merging');
    expect(md).toContain('🔴 must · line 5 · Waiting (no-fixed-wait)');
    expect(md).not.toContain('clean.spec.ts');
    expect(formatReviewMarkdown([{ file: 'clean.spec.ts', findings: [] }])).toContain('nothing to change');
  });
});
