import { describe, expect, it } from 'vitest';
import { FakeProvider } from '@aiqa/ai-engine';
import { formatHealReport, HealingEngine, LlmStrategy } from '../src';
import { element, fingerprint } from './helpers';

const stored = fingerprint({
  accessibleName: 'Button with Dynamic ID',
  text: 'Button with Dynamic ID',
  attributes: { id: 'a1b2', class: 'btn btn-primary' },
});

describe('HealingEngine', () => {
  it('heals when a generated id changed and one element still matches', async () => {
    const moved = element({
      ...stored,
      attributes: { id: 'z9y8', class: 'btn btn-primary' },
      cssPath: '#z9y8',
    });
    const decision = await new HealingEngine().heal(stored, [
      element({ accessibleName: 'Home', text: 'Home', tag: 'a', role: 'link' }),
      moved,
    ]);
    expect(decision.outcome).toBe('healed');
    expect(decision.candidate?.element).toBe(moved);
    expect(decision.candidate?.suggestion).toBe(
      "page.getByRole('button', { name: 'Button with Dynamic ID' })",
    );
  });

  it('refuses when two identical elements match: it will not guess', async () => {
    const twin = () => element({ ...stored, attributes: { class: 'btn btn-primary' } });
    const decision = await new HealingEngine().heal(stored, [twin(), twin()]);
    expect(decision.outcome).toBe('refused');
    expect(decision.reason).toMatch(/Ambiguous: 2 elements/);
    expect(decision.ranked).toHaveLength(2);
  });

  it('refuses when nothing on the page resembles the fingerprint', async () => {
    const decision = await new HealingEngine().heal(stored, [
      element({ tag: 'a', role: 'link', accessibleName: 'Help', text: 'Help' }),
    ]);
    expect(decision.outcome).toBe('refused');
    expect(decision.candidate).toBeUndefined();
  });

  it('refuses a weak match below the threshold and says so', async () => {
    const weak = element({
      accessibleName: 'Button with Dynamic IDs',
      text: 'Something else entirely',
      attributes: { class: 'link' },
      ancestorPath: 'body>nav>button',
    });
    const decision = await new HealingEngine({ threshold: 0.9 }).heal(stored, [weak]);
    expect(decision.outcome).toBe('refused');
    expect(decision.reason).toMatch(/below the 0.9 threshold/);
  });

  it('prefers the element that kept its test id over a look-alike', async () => {
    const withId = fingerprint({ ...stored, testId: 'submit' });
    const real = element({ ...stored, testId: 'submit', text: 'Send', accessibleName: 'Send' });
    const lookAlike = element({ ...stored, testId: '' });
    const decision = await new HealingEngine({ threshold: 0.5 }).heal(withId, [lookAlike, real]);
    expect(decision.candidate?.element).toBe(real);
    expect(decision.candidate?.strategy).toBe('testId');
  });

  describe('with a model as tie-breaker', () => {
    const twins = [
      element({ ...stored, cssPath: 'li:nth-of-type(1) > button' }),
      element({ ...stored, cssPath: 'li:nth-of-type(2) > button' }),
    ];

    it('lets the model choose between elements that all pass the threshold', async () => {
      const engine = new HealingEngine({ tieBreaker: new LlmStrategy(new FakeProvider(['{"index":1}'])) });
      const decision = await engine.heal(stored, twins);
      expect(decision.outcome).toBe('healed');
      expect(decision.candidate?.element).toBe(twins[1]);
      expect(decision.candidate?.strategy).toBe('llm');
    });

    it.each([
      ['declines', '{"index":-1}'],
      ['answers out of range', '{"index":42}'],
      ['returns prose instead of JSON', 'I think the first one'],
    ])('still refuses when the model %s', async (_label, answer) => {
      const engine = new HealingEngine({ tieBreaker: new LlmStrategy(new FakeProvider([answer])) });
      expect((await engine.heal(stored, twins)).outcome).toBe('refused');
    });

    it('never consults the model when rules already found one clear match', async () => {
      const provider = new FakeProvider([]);
      const engine = new HealingEngine({ tieBreaker: new LlmStrategy(provider) });
      await engine.heal(stored, [element({ ...stored })]);
      expect(provider.calls).toHaveLength(0);
    });

    it('cannot heal below the threshold even with a model', async () => {
      const provider = new FakeProvider(['{"index":0}']);
      const engine = new HealingEngine({ threshold: 0.99, tieBreaker: new LlmStrategy(provider) });
      const decision = await engine.heal(stored, [
        element({ ...stored, text: 'Other', accessibleName: 'Other' }),
      ]);
      expect(decision.outcome).toBe('refused');
      expect(provider.calls).toHaveLength(0);
    });
  });
});

describe('formatHealReport', () => {
  it('shows the broken locator, the decision and a pasteable fix', async () => {
    const decision = await new HealingEngine().heal(stored, [element({ ...stored })]);
    const report = formatHealReport(stored, decision);
    expect(report).toContain('# Self-healing: HEALED');
    expect(report).toContain("- locator('#old-id')");
    expect(report).toContain("+ page.getByRole('button', { name: 'Button with Dynamic ID' })");
  });
});

describe('LlmStrategy prompt', () => {
  it('gives the model the text around each element, which is what tells twins apart', async () => {
    const lost = fingerprint({
      accessibleName: 'Add to cart',
      text: 'Add to cart',
      context: 'Bike Light $9.99 Add to cart',
    });
    const twins = [
      element({ accessibleName: 'Add to cart', text: 'Add to cart', context: 'Backpack $29.99 Add to cart' }),
      element({
        accessibleName: 'Add to cart',
        text: 'Add to cart',
        context: 'Bike Light $9.99 Add to cart',
      }),
    ];
    // A stand-in "model" that reads the prompt the way a real one would.
    const provider = new FakeProvider((request) => {
      const lines = request.prompt.split('\n').filter((line) => /^\d+\. /.test(line));
      return JSON.stringify({ index: lines.findIndex((line) => line.includes('near="Bike Light')) });
    });
    const decision = await new HealingEngine({ tieBreaker: new LlmStrategy(provider) }).heal(lost, twins);
    expect(decision.candidate?.element).toBe(twins[1]);
    expect(provider.calls[0]?.prompt).toContain('near="Bike Light $9.99 Add to cart"');
  });
});
