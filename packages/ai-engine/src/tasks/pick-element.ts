import { z } from 'zod';
import { completeJson } from '../json';
import { prompts } from '../prompts';
import type { LlmProvider } from '../provider';

const answerSchema = z.object({ index: z.number().int() });

/**
 * Ask the model which candidate is the lost element.
 * Returns an index into `candidates`, or undefined when the model declines,
 * answers out of range, or returns anything that is not the expected JSON.
 */
export async function pickElement(
  provider: LlmProvider,
  fingerprint: string,
  candidates: string[],
): Promise<number | undefined> {
  if (candidates.length === 0) return undefined;
  const answer = await completeJson(
    provider,
    { system: prompts.pickElement.system, prompt: prompts.pickElement.user(fingerprint, candidates) },
    answerSchema,
  );
  if (!answer || answer.index < 0 || answer.index >= candidates.length) return undefined;
  return answer.index;
}
