import { z } from 'zod';
import { completeJson } from '../json';
import { prompts } from '../prompts';
import type { LlmProvider } from '../provider';

export interface GenerateDataOptions<T> {
  /** What the record is for, in plain words: "a hotel booking for a family in December". */
  hint: string;
  /** Used when AI is off, the model is unreachable, or every answer fails the schema. */
  fallback: () => T;
  /** How many times to ask before giving up. Default 2. */
  attempts?: number;
}

export interface GeneratedData<T> {
  data: T;
  source: 'model' | 'fallback';
}

/**
 * Asks the model for one test record that fits a zod schema.
 * The schema is sent as JSON Schema, and the answer is validated against the same zod schema,
 * so whatever comes back is either valid data or ignored. A test never depends on the model:
 * the fallback (usually a faker-based builder) always produces a usable record.
 */
export async function generateData<T>(
  provider: LlmProvider,
  schema: z.ZodType<T>,
  options: GenerateDataOptions<T>,
): Promise<GeneratedData<T>> {
  const fallback = (): GeneratedData<T> => ({ data: options.fallback(), source: 'fallback' });
  if (!(await provider.isAvailable())) return fallback();

  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  for (let attempt = 0; attempt < (options.attempts ?? 2); attempt++) {
    const data = await completeJson(
      provider,
      { system: prompts.generateData.system, prompt: prompts.generateData.user(options.hint, jsonSchema) },
      schema,
    );
    if (data !== undefined) return { data, source: 'model' };
  }
  return fallback();
}
