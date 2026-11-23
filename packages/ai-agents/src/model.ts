import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Env } from '@aiqa/shared';
import type { LanguageModel } from 'ai';
import { createOllama } from 'ai-sdk-ollama';

export type AgentModelEnv = Pick<
  Env,
  | 'AI_ENABLED'
  | 'OLLAMA_URL'
  | 'OLLAMA_MODEL'
  | 'AGENT_PROVIDER'
  | 'AGENT_MODEL'
  | 'AGENT_BASE_URL'
  | 'AGENT_API_KEY'
  | 'AGENT_THINK'
>;

/** The model an agent runs on, with a name for the run log. `undefined` model = rules only. */
export interface ModelChoice {
  model?: LanguageModel;
  /** e.g. "ollama:qwen3:8b", "openai-compatible:gpt-4.1-mini", "off". */
  label: string;
}

/**
 * Factory: the one place that decides which model agents use (ADR 0014).
 * Off unless asked for: AI_ENABLED=true or an explicit AGENT_PROVIDER.
 */
export function chooseModel(env: AgentModelEnv): ModelChoice {
  const provider = env.AGENT_PROVIDER === 'auto' ? (env.AI_ENABLED ? 'ollama' : 'off') : env.AGENT_PROVIDER;
  if (provider === 'off') return { label: 'off' };
  if (provider === 'ollama') {
    const name = env.AGENT_MODEL ?? env.OLLAMA_MODEL;
    const ollama = createOllama({ baseURL: env.OLLAMA_URL });
    if (env.AGENT_THINK === undefined) return { model: ollama(name), label: `ollama:${name}` };
    return {
      model: ollama(name, { think: env.AGENT_THINK }),
      label: `ollama:${name}${env.AGENT_THINK ? '' : ' (no thinking)'}`,
    };
  }
  if (!env.AGENT_BASE_URL || !env.AGENT_MODEL) {
    throw new Error(
      'AGENT_PROVIDER=openai-compatible needs AGENT_BASE_URL and AGENT_MODEL (and usually AGENT_API_KEY).',
    );
  }
  const hosted = createOpenAICompatible({
    name: 'hosted',
    baseURL: env.AGENT_BASE_URL,
    apiKey: env.AGENT_API_KEY,
    supportsStructuredOutputs: true,
  });
  return { model: hosted.chatModel(env.AGENT_MODEL), label: `openai-compatible:${env.AGENT_MODEL}` };
}
