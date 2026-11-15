import { z } from 'zod';
import { completeJson } from '../json';
import { prompts } from '../prompts';
import type { LlmProvider } from '../provider';

export type FailureCategory = 'product' | 'test' | 'environment' | 'flaky' | 'unknown';

export interface FailureInput {
  errorMessage: string;
  consoleErrors?: string[];
  failedRequests?: string[];
  /** True when the same test passed on a retry in the same run. */
  passedOnRetry?: boolean;
}

export interface FailureVerdict {
  category: FailureCategory;
  reason: string;
  source: 'rules' | 'model';
}

const ENVIRONMENT = /net::ERR_|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|\b50[234]\b|target-down/i;
const LOCATOR =
  /strict mode violation|waiting for (locator|getBy)|locator\.\w+: Timeout|element is not (visible|enabled|attached)/i;
const ASSERTION = /expect\(.*\)\.(not\.)?to\w+|Expected.*\n?.*Received/i;

/** Deterministic rules first: free, instant, and explainable. */
export function classifyByRules(input: FailureInput): FailureVerdict | undefined {
  const rule = (category: FailureCategory, reason: string): FailureVerdict => ({
    category,
    reason,
    source: 'rules',
  });
  if (input.passedOnRetry) return rule('flaky', 'The test passed on retry within the same run.');
  const haystack = [input.errorMessage, ...(input.failedRequests ?? [])].join('\n');
  if (ENVIRONMENT.test(haystack))
    return rule('environment', 'A network or server error occurred; the target may be down.');
  if (LOCATOR.test(input.errorMessage))
    return rule('test', 'A locator did not resolve; the page structure or the locator changed.');
  if (ASSERTION.test(input.errorMessage))
    return rule('product', 'An assertion on application behaviour failed.');
  return undefined;
}

const verdictSchema = z.object({
  category: z.enum(['product', 'test', 'environment', 'flaky']),
  reason: z.string().min(1).max(300),
});

/** Rules decide when they can; the model is asked only for what rules cannot classify. */
export async function analyzeFailure(input: FailureInput, provider?: LlmProvider): Promise<FailureVerdict> {
  const byRules = classifyByRules(input);
  if (byRules) return byRules;
  if (provider && (await provider.isAvailable())) {
    const answer = await completeJson(
      provider,
      {
        system: prompts.failure.system,
        prompt: prompts.failure.user(
          input.errorMessage,
          input.consoleErrors ?? [],
          input.failedRequests ?? [],
        ),
      },
      verdictSchema,
    );
    if (answer) return { ...answer, source: 'model' };
  }
  return {
    category: 'unknown',
    reason: 'No rule matched and no model verdict was available.',
    source: 'rules',
  };
}
