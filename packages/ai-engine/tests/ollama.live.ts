import { beforeAll, describe, expect, it } from 'vitest';
import { parseEnv } from '@aiqa/shared';
import { z } from 'zod';
import {
  analyzeFailure,
  createProvider,
  draftBugReport,
  generateData,
  generateLocator,
  type LlmProvider,
} from '../src';

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

  it('picks the described element when the words do not match its name', async (context) => {
    if (!available) return context.skip();
    const snapshot = [
      '- textbox "Username"',
      '- textbox "Password"',
      '- button "Login"',
      '- link "Forgot your password?"',
    ].join('\n');
    // No rule can link "sign in" to "Login"; the model has to.
    const suggestion = await generateLocator(provider, snapshot, 'the control that signs the user in');
    console.log('locator suggestion:', JSON.stringify(suggestion));
    expect(suggestion).toMatchObject({ role: 'button', name: 'Login', source: 'model' });
  });

  it('writes a test record that fits the schema and the scenario', async (context) => {
    if (!available) return context.skip();
    const schema = z.object({
      firstname: z.string().min(1),
      lastname: z.string().min(1),
      totalprice: z.number().int().min(1).max(5000),
      depositpaid: z.boolean(),
      additionalneeds: z.string().min(1),
    });
    const fallback = () => ({
      firstname: 'F',
      lastname: 'B',
      totalprice: 1,
      depositpaid: true,
      additionalneeds: 'x',
    });
    const result = await generateData(provider, schema, {
      hint: 'a guest from India who has not paid a deposit and needs an airport pickup',
      fallback,
    });
    console.log('generated data:', JSON.stringify(result));
    expect(result.source).toBe('model');
    expect(result.data.depositpaid).toBe(false);
  });
});
