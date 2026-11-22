import type { z } from 'zod';
import type { RunLog } from './log';
import type { ModelChoice } from './model';
import { runAgent, runRecord } from './runtime';

export interface AgentCallOptions {
  model?: ModelChoice;
  log?: RunLog;
  timeoutMs?: number;
}

/**
 * One model call with no tools, logged, that never throws: the shape every one-shot agent shares.
 * Returns the parsed answer, or undefined with the reason (no model, timeout, bad JSON, schema).
 */
export async function askModel<O>(
  agent: string,
  call: {
    system: string;
    prompt: string;
    output: z.ZodType<O>;
    logInput: unknown;
    logOutput?: (o: O) => unknown;
  },
  options: AgentCallOptions,
): Promise<{ output?: O; reason?: string }> {
  const started = Date.now();
  const base = { agent, model: options.model?.label ?? 'off', input: call.logInput, toolCalls: [] };
  if (!options.model?.model) {
    options.log?.write(
      runRecord({
        ...base,
        durationMs: 0,
        source: 'rules',
        fallbackReason: 'no model configured',
        output: null,
      }),
    );
    return { reason: 'no model configured' };
  }
  try {
    const run = await runAgent({
      agent,
      model: options.model.model,
      modelLabel: options.model.label,
      system: call.system,
      prompt: call.prompt,
      tools: [],
      output: call.output,
      maxToolCalls: 0,
      timeoutMs: options.timeoutMs,
    });
    options.log?.write(
      runRecord({
        ...base,
        durationMs: run.durationMs,
        source: 'model',
        output: call.logOutput ? call.logOutput(run.output) : run.output,
        tokens: run.tokens,
      }),
    );
    return { output: run.output };
  } catch (error) {
    const reason = `model failed: ${(error as Error).message.split('\n')[0]}`;
    options.log?.write(
      runRecord({
        ...base,
        durationMs: Date.now() - started,
        source: 'rules',
        fallbackReason: reason,
        output: null,
      }),
    );
    return { reason };
  }
}
