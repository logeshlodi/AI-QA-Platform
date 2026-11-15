import { beforeAll, describe, expect, it } from 'vitest';
import { parseEnv } from '@aiqa/shared';
import { analyzeFailure, createProvider, draftBugReport, type LlmProvider } from '../src';

/**
 * Talks to the real local model. Not part of `pnpm test:unit`.
 * Every test skips itself unless AI_ENABLED=true and the model is pulled.
 */
const env = parseEnv(process.env);
let provider: LlmProvider;
let available = false;

beforeAll(async () => {
  provider = createProvider(env);
  available = env.AI_ENABLED && (await provider.isAvailable());
});

describe('local model (Ollama)', () => {
  it('classifies a failure that no rule matches, and explains why', async (context) => {
    if (!available) return context.skip();
    const verdict = await analyzeFailure(
      {
        errorMessage:
          "TypeError: Cannot read properties of null (reading 'price')\n    at CartTotals.render (cart-totals.js:42:19)",
        consoleErrors: ["Uncaught TypeError: Cannot read properties of null (reading 'price')"],
        failedRequests: [],
      },
      provider,
    );
    console.log('failure verdict:', JSON.stringify(verdict));
    expect(verdict.source).toBe('model');
    // An exception thrown inside the application's own code is a product defect.
    expect(verdict.category).toBe('product');
    expect(verdict.reason.length).toBeGreaterThan(10);
  });

  it('drafts a bug report with the requested sections from the given facts', async (context) => {
    if (!available) return context.skip();
    const report = await draftBugReport(
      {
        title: 'Checkout shows the wrong subtotal',
        steps: [
          'Log in as standard_user',
          'Add Sauce Labs Backpack and Sauce Labs Bike Light to the cart',
          'Open the checkout overview',
        ],
        errorMessage: 'Expected: "Item total: $39.98"\nReceived: "Item total: $29.99"',
      },
      provider,
    );
    console.log(`bug report:\n${report}`);
    expect(report).toMatch(/Steps to reproduce/i);
    expect(report).toContain('39.98');
    expect(report).toContain('29.99');
  });
});
