import type { Env } from '@aiqa/shared';
import type { LlmProvider } from '../provider';
import { NullProvider } from './fake';
import { OllamaProvider } from './ollama';

/** Factory: the one place that decides which provider the platform uses. */
export function createProvider(
  env: Pick<Env, 'AI_ENABLED' | 'OLLAMA_URL' | 'OLLAMA_MODEL'> & Partial<Pick<Env, 'OLLAMA_TIMEOUT_MS'>>,
): LlmProvider {
  if (!env.AI_ENABLED) return new NullProvider();
  return new OllamaProvider({
    baseUrl: env.OLLAMA_URL,
    model: env.OLLAMA_MODEL,
    timeoutMs: env.OLLAMA_TIMEOUT_MS,
  });
}
