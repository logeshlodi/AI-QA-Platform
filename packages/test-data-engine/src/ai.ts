import { createProvider, generateData, type LlmProvider } from '@aiqa/ai-engine';
import { loadEnv } from '@aiqa/shared';
import type { z } from 'zod';

/**
 * A record from the local model when AI is on, from the builder when it is off or the model's
 * answer fails the schema. Either way the result is valid, and `source` says where it came from.
 */
export async function generateOr<T>(
  schema: z.ZodType<T>,
  hint: string,
  fallback: () => T,
  provider: LlmProvider = createProvider(loadEnv()),
): Promise<{ data: T; source: 'model' | 'fallback' }> {
  return generateData(provider, schema, { hint, fallback });
}
