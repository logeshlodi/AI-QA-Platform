import { describe, expect, it } from 'vitest';
import { analyzeFailure, classifyByRules, FakeProvider } from '../src';

describe('classifyByRules', () => {
  it.each([
    ['page.goto: net::ERR_NAME_NOT_RESOLVED at https://x', 'environment'],
    ['locator.click: Timeout 5000ms exceeded.\nwaiting for locator("#gone")', 'test'],
    ['Error: strict mode violation: getByRole("button") resolved to 3 elements', 'test'],
    ['Error: expect(locator).toHaveText(expected)\nExpected: "A"\nReceived: "B"', 'product'],
  ])('%s -> %s', (errorMessage, category) => {
    expect(classifyByRules({ errorMessage })?.category).toBe(category);
  });

  it('calls a retry-pass flaky before looking at the error text', () => {
    expect(classifyByRules({ errorMessage: 'expect(x).toBe(y)', passedOnRetry: true })?.category).toBe(
      'flaky',
    );
  });

  it('returns undefined when no rule applies', () => {
    expect(classifyByRules({ errorMessage: 'something odd happened' })).toBeUndefined();
  });
});

describe('analyzeFailure', () => {
  it('does not call the model when a rule already decides', async () => {
    const provider = new FakeProvider([]);
    const verdict = await analyzeFailure({ errorMessage: 'net::ERR_CONNECTION_REFUSED' }, provider);
    expect(verdict).toMatchObject({ category: 'environment', source: 'rules' });
    expect(provider.calls).toHaveLength(0);
  });

  it('uses a valid model verdict for unclassified errors', async () => {
    const provider = new FakeProvider(['{"category":"product","reason":"Total is wrong."}']);
    const verdict = await analyzeFailure({ errorMessage: 'something odd happened' }, provider);
    expect(verdict).toEqual({ category: 'product', reason: 'Total is wrong.', source: 'model' });
  });

  it('ignores a model answer that breaks the schema', async () => {
    const provider = new FakeProvider(['{"category":"aliens","reason":"x"}']);
    const verdict = await analyzeFailure({ errorMessage: 'something odd happened' }, provider);
    expect(verdict.category).toBe('unknown');
  });

  it('falls back to unknown when the model is unavailable', async () => {
    const verdict = await analyzeFailure(
      { errorMessage: 'something odd happened' },
      new FakeProvider([], false),
    );
    expect(verdict.category).toBe('unknown');
  });
});
