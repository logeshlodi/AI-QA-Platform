import { z } from 'zod';
import { ConfigError } from './errors';

const flag = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

/**
 * Single source of truth for environment variables.
 * WHY zod: one schema gives the runtime check and the TypeScript type,
 * so a typo in a variable name fails at start-up instead of mid-run.
 */
export const envSchema = z.object({
  CI: z
    .string()
    .optional()
    .transform((v) => Boolean(v) && v !== 'false' && v !== '0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  HEAL_MODE: z.enum(['off', 'suggest', 'runtime']).default('suggest'),
  HEAL_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  AI_ENABLED: flag.default(false),
  OLLAMA_URL: z.url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen2.5-coder:7b'),
  // Generous by default: the first call loads the model into memory, which is slow on a CPU.
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  // Agents (packages/ai-agents). "auto" = Ollama when AI_ENABLED, otherwise rules only.
  // "openai-compatible" reaches any hosted or local server that speaks the OpenAI chat API.
  AGENT_PROVIDER: z.enum(['auto', 'off', 'ollama', 'openai-compatible']).default('auto'),
  AGENT_MODEL: z.string().min(1).optional(),
  AGENT_BASE_URL: z.url().optional(),
  AGENT_API_KEY: z.string().min(1).optional(),
  AGENT_MAX_TOOL_CALLS: z.coerce.number().int().min(0).max(30).default(6),
  // How long one model answer may take. A 7B model on CPU needs minutes for a plan or a spec.
  AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(900_000),
});

export type Env = z.infer<typeof envSchema>;
export type HealMode = Env['HEAL_MODE'];

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Parsed once per process. Config is the one place a module-level singleton is safe. */
export function loadEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
