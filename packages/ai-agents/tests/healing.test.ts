import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPatchableSources, type HealEvent } from '@aiqa/self-healing-engine';
import { MemoryRunLog, reviewHeals } from '../src';
import { scriptedModel } from './mock';

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-heal-review-'));
  fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'pages', 'pay.page.ts'),
    "export class PayPage {\n  constructor(private readonly page: any) {}\n  payButton = () => this.page.locator('#btn-1001');\n}\n",
  );
  return {
    root,
    sources: readPatchableSources(root),
    read: () => fs.readFileSync(path.join(root, 'src', 'pages', 'pay.page.ts'), 'utf8'),
  };
}

describe('reviewHeals', () => {
  it('proposes a patch with a template description and writes nothing without approval', async () => {
    const ws = workspace();
    const log = new MemoryRunLog();
    const [review] = await reviewHeals([healed], { root: ws.root, sources: ws.sources, apply: true, log });
    expect(review).toMatchObject({
      status: 'declined',
      source: 'rules',
      title: 'Update locator PayPage.payButton',
    });
    expect(review?.diff).toContain(
      "+  payButton = () => this.page.getByRole('button', { name: 'Pay now' });",
    );
    expect(ws.read()).toContain("locator('#btn-1001')");
    expect(log.records[0]).toMatchObject({
      agent: 'healing-review',
      toolCalls: [{ tool: 'apply_patch', status: 'denied' }],
    });
  });

  it('writes the patch once a person approves it, with the model writing the description', async () => {
    const ws = workspace();
    const { model } = scriptedModel([
      {
        answer: {
          title: 'Use the role locator for the Pay button',
          body: 'The generated id changed on every build; the role and name did not.',
        },
      },
    ]);
    const asked: unknown[] = [];
    const [review] = await reviewHeals([healed], {
      root: ws.root,
      sources: ws.sources,
      model: { model, label: 'mock' },
      apply: true,
      approve: async (call) => {
        asked.push(call);
        return true;
      },
    });
    expect(review).toMatchObject({
      status: 'applied',
      source: 'model',
      title: 'Use the role locator for the Pay button',
    });
    expect(asked).toHaveLength(1);
    expect(ws.read()).toContain("this.page.getByRole('button', { name: 'Pay now' })");
  });

  it('keeps the template when the model fails, and reports refusals with their reason', async () => {
    const ws = workspace();
    const { model } = scriptedModel([{ fail: 'model offline' }]);
    const reviews = await reviewHeals(
      [
        healed,
        { ...healed, locatorKey: 'Cart.badge', failedSelector: "locator('.badge')", outcome: 'refused' },
      ],
      { root: ws.root, sources: ws.sources, model: { model, label: 'mock' } },
    );
    expect(reviews).toEqual([
      expect.objectContaining({ locatorKey: 'PayPage.payButton', status: 'proposed', source: 'rules' }),
      expect.objectContaining({
        locatorKey: 'Cart.badge',
        status: 'refused',
        reason: expect.stringMatching(/refused this heal/),
      }),
    ]);
  });

  it('reviews only the latest event per locator', async () => {
    const ws = workspace();
    const older = { ...healed, suggestion: "page.getByText('Pay now')", createdAt: '2026-11-19T10:00:00Z' };
    const reviews = await reviewHeals([healed, older], { root: ws.root, sources: ws.sources });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.diff).toContain('getByRole');
  });
});
