import { randomUUID } from 'node:crypto';
import { generateText, isStepCount, Output, tool, type LanguageModel, type ToolSet } from 'ai';
import type { z } from 'zod';
import type { AgentRunRecord, ToolCallRecord } from './log';
import { denyWrites, type AgentTool, type Approver } from './tools';

export interface AgentRunOptions<O> {
  /** Name in the run log, e.g. "triage". */
  agent: string;
  model: LanguageModel;
  modelLabel: string;
  system: string;
  prompt: string;
  tools: AgentTool[];
  output: z.ZodType<O>;
  /** Tool calls allowed before the agent must answer. Default 6. */
  maxToolCalls?: number;
  approve?: Approver;
  timeoutMs?: number;
}

export interface AgentRunResult<O> {
  output: O;
  toolCalls: ToolCallRecord[];
  steps: number;
  tokens: { input: number; output: number };
  durationMs: number;
}

/**
 * Runs one agent: the model may call its tools up to the budget, then must answer in the output
 * schema. Every call is checked here, not by the model:
 *  - over budget: the tool is not run; the model is told to answer now,
 *  - a write tool: runs only if `approve` says yes for that exact call (default: never),
 *  - a tool that throws: the error goes back to the model as data, the run carries on.
 * Throws when the model fails or answers outside the schema; callers decide the fallback.
 */
export async function runAgent<O>(options: AgentRunOptions<O>): Promise<AgentRunResult<O>> {
  const started = Date.now();
  const budget = options.maxToolCalls ?? 6;
  const approve = options.approve ?? denyWrites;
  const calls: ToolCallRecord[] = [];

  const tools: ToolSet = {};
  for (const t of options.tools) {
    tools[t.name] = tool({
      description: t.kind === 'write' ? `${t.description} (needs a person's approval)` : t.description,
      inputSchema: t.input,
      execute: async (input: unknown) => {
        const began = Date.now();
        const record = (status: ToolCallRecord['status'], error?: string): void => {
          calls.push({ tool: t.name, input, status, error, durationMs: Date.now() - began });
        };
        if (calls.length >= budget) {
          record('over-budget');
          return { error: 'Tool budget used up. Answer now with what you have.' };
        }
        if (t.kind === 'write' && !(await approve({ agent: options.agent, tool: t.name, input }))) {
          record('denied');
          return { error: 'A person declined this action. Do not retry it.' };
        }
        try {
          const result = await t.run(input);
          record('ok');
          return result;
        } catch (error) {
          const message = (error as Error).message;
          record('error', message);
          return { error: message };
        }
      },
    });
  }

  const result = await generateText({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    tools,
    // One step per tool round plus the answer; a model that keeps calling past the budget is cut off.
    stopWhen: isStepCount(budget + 2),
    prepareStep: async () => (calls.length >= budget ? { activeTools: [] } : {}),
    output: Output.object({ schema: options.output }),
    temperature: 0,
    abortSignal: AbortSignal.timeout(options.timeoutMs ?? 300_000),
  });

  return {
    output: result.output as O,
    toolCalls: calls,
    steps: result.steps.length,
    tokens: { input: result.totalUsage.inputTokens ?? 0, output: result.totalUsage.outputTokens ?? 0 },
    durationMs: Date.now() - started,
  };
}

/** Builds the run-log line for one run, so every agent logs the same shape. */
export function runRecord(
  fields: Omit<AgentRunRecord, 'id' | 'startedAt'> & { startedAt?: string },
): AgentRunRecord {
  return { id: randomUUID(), startedAt: fields.startedAt ?? new Date().toISOString(), ...fields };
}
