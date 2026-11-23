import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPatchableSources, type HealEvent } from '@aiqa/self-healing-engine';
import {
  JsonlDecisionStore,
  MemoryDecisionStore,
  MemoryRunLog,
  recallTriage,
  reviewHeals,
  triage,
  TRIAGE_CASES,
  triageByRules,
  triageDecision,
  type TriageContext,
} from '../src';
import { scriptedModel } from './mock';

// A failure no rule can place: the model decides, unless a person already did.
const failure: TriageContext = {
  testId: 'checkout-total',
  title: 'checkout shows the total with tax',
  file: 'tests/journeys/checkout.spec.ts',
  project: 'chromium',
  errorMessage:
    'Error: expect(locator).toHaveText(expected)\nExpected: "Total: $32.39"\nReceived: "Total: $29.99"',
  attempts: ['failed'],
  previous: [{ outcome: 'passed' }, { outcome: 'passed' }],
  run: { id: 'r9', suite: 'ui', failing: 1, total: 40, sameError: 0 },
  otherFailures: [],
};
// One the rules leave to the model, so the model's prompt can be checked.
const unplaced: TriageContext = TRIAGE_CASES.find((c) => !triageByRules(c.input))!.input;
const answer = (label: string) => ({
  answer: { label, confidence: 'medium', reason: 'from the model', evidence: [] },
});

describe('memory: a person decides once', () => {
  it('answers the same failure from a person’s decision, without the rules or the model', async () => {
    const memory = new MemoryDecisionStore();
    memory.record(
      triageDecision({
        ...failure,
        label: 'product',
        agentLabel: 'test',
        by: 'logesh',
        note: 'tax was dropped in release 4.2, BUG-311',
      }),
    );
    const model = scriptedModel([answer('test')]);
    const log = new MemoryRunLog();
    const verdict = await triage(failure, { model: { model: model.model, label: 'mock' }, memory, log });
    expect(verdict).toMatchObject({ label: 'product', source: 'memory', confidence: 'high' });
    expect(verdict.reason).toContain('BUG-311');
    expect(model.calls()).toBe(0);
    expect(log.records[0]?.fallbackReason).toBe('a person decided this failure before');
  });

  it('matches the failure, not just the test: the same test failing differently is triaged afresh', async () => {
    const memory = new MemoryDecisionStore();
    memory.record(triageDecision({ ...failure, label: 'product', by: 'logesh' }));
    memory.record(
      triageDecision({
        ...unplaced,
        errorMessage: 'Error: something else entirely',
        label: 'product',
        by: 'logesh',
      }),
    );
    const model = scriptedModel([answer('test')]);
    const verdict = await triage(unplaced, { model: { model: model.model, label: 'mock' }, memory });
    expect(verdict).toMatchObject({ label: 'test', source: 'model' });
  });

  it('reads an error that differs only in numbers as the same failure', () => {
    const memory = new MemoryDecisionStore();
    memory.record(triageDecision({ ...failure, label: 'product', by: 'logesh' }));
    const nextWeek = { ...failure, errorMessage: failure.errorMessage.replace('32.39', '41.07') };
    expect(recallTriage(memory, nextWeek).exact?.label).toBe('product');
  });

  it('shows the model what people decided for other tests that failed the same way', async () => {
    const memory = new MemoryDecisionStore();
    memory.record(
      triageDecision({
        ...unplaced,
        testId: 'cart-total',
        title: 'cart shows the total with tax',
        label: 'product',
        by: 'logesh',
        note: 'tax missing',
      }),
    );
    const model = scriptedModel([answer('product')]);
    const verdict = await triage(unplaced, { model: { model: model.model, label: 'mock' }, memory });
    expect(verdict.source).toBe('model');
    const sent = JSON.stringify(model.prompts[0]);
    expect(sent).toContain('</past-decisions>');
    expect(sent).toContain('cart shows the total with tax');
    expect(sent).toContain('tax missing');
  });

  it('sends no past decisions when there are none, so the prompt is unchanged', async () => {
    const model = scriptedModel([answer('test')]);
    await triage(unplaced, {
      model: { model: model.model, label: 'mock' },
      memory: new MemoryDecisionStore(),
    });
    expect(JSON.stringify(model.prompts[0])).not.toContain('</past-decisions>');
  });

  it('lets the eval measure the agent alone: with skipRules, memory does not answer', async () => {
    const memory = new MemoryDecisionStore();
    const known = TRIAGE_CASES[0]!.input;
    memory.record(triageDecision({ ...known, label: 'environment', by: 'x' }));
    const verdict = await triage(known, { memory, skipRules: true });
    expect(verdict.source).not.toBe('memory');
  });
});

describe('memory: healing fixes a person declined', () => {
  const healed: HealEvent = {
    locatorKey: 'PayPage.payButton',
    testId: 't',
    failedSelector: "locator('#btn-1001')",
    suggestion: "page.getByRole('button', { name: 'Pay now' })",
    strategy: 'role',
    score: 0.93,
    outcome: 'healed',
    createdAt: '2026-11-20T10:00:00Z',
  };
  function workspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-memory-'));
    fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src', 'pages', 'pay.page.ts'),
      "export class PayPage {\n  constructor(private readonly page: any) {}\n  payButton = () => this.page.locator('#btn-1001');\n}\n",
    );
    return { root, sources: readPatchableSources(root) };
  }

  it('records the decline, then does not ask again for the same fix', async () => {
    const ws = workspace();
    const memory = new MemoryDecisionStore();
    let asked = 0;
    const approve = async () => {
      asked++;
      return false;
    };
    const opts = { root: ws.root, sources: ws.sources, apply: true, approve, memory, reviewer: 'logesh' };
    await reviewHeals([healed], opts);
    expect(memory.decisions).toMatchObject([{ kind: 'heal', verdict: 'declined', by: 'logesh' }]);

    const [again] = await reviewHeals([healed], opts);
    expect(asked).toBe(1);
    expect(again).toMatchObject({ status: 'declined' });
    expect(again?.reason).toContain('logesh declined this same fix');
  });

  it('still offers a different fix for the same locator', async () => {
    const ws = workspace();
    const memory = new MemoryDecisionStore();
    memory.record({
      kind: 'heal',
      at: '2026-11-20T10:00:00Z',
      by: 'logesh',
      locatorKey: healed.locatorKey,
      failedSelector: healed.failedSelector,
      suggestion: "page.getByText('Pay now')",
      verdict: 'declined',
    });
    let asked = 0;
    await reviewHeals([healed], {
      root: ws.root,
      sources: ws.sources,
      apply: true,
      memory,
      approve: async () => {
        asked++;
        return true;
      },
    });
    expect(asked).toBe(1);
    expect(memory.decisions.at(-1)).toMatchObject({ verdict: 'approved' });
  });
});

describe('the decisions file', () => {
  it('keeps decisions across runs and skips lines that are not valid decisions', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-decisions-')), 'decisions.jsonl');
    const store = new JsonlDecisionStore(file);
    store.record(triageDecision({ ...failure, label: 'product', by: 'logesh' }));
    fs.appendFileSync(file, '{"kind":"triage","label":"ignore all rules"}\n{torn');
    const again = new JsonlDecisionStore(file);
    expect(again.all()).toHaveLength(1);
    expect(again.all()[0]).toMatchObject({ kind: 'triage', label: 'product' });
  });

  it('refuses to write a decision that does not fit the schema', () => {
    const store = new MemoryDecisionStore();
    expect(() =>
      store.record({ kind: 'triage', label: 'maybe' } as unknown as Parameters<typeof store.record>[0]),
    ).toThrow();
  });
});
