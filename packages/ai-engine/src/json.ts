import type { z } from 'zod';
import type { CompletionRequest, LlmProvider } from './provider';

/**
 * Ask for JSON and validate it against a schema.
 * Model output is untrusted input: anything that fails to parse or validate
 * yields `undefined`, never an exception and never a half-trusted object.
 */
export async function completeJson<T>(
  provider: LlmProvider,
  request: CompletionRequest,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  let raw: string;
  try {
    raw = await provider.complete({ ...request, json: true });
  } catch {
    return undefined;
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
