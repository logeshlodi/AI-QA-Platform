import { MockLanguageModelV4 } from 'ai/test';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

export type Turn =
  { call: string; input?: unknown } | { answer: unknown } | { text: string } | { fail: string };

/**
 * A model that plays a fixed script: each turn either calls a tool, answers with JSON, or throws.
 * After the script ends it keeps giving the last turn. `prompts` records what it was sent.
 */
export function scriptedModel(turns: Turn[]) {
  let i = 0;
  const prompts: unknown[] = [];
  const toolsOffered: string[][] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      prompts.push(options.prompt);
      toolsOffered.push((options.tools ?? []).map((t) => t.name));
      const turn = turns[Math.min(i++, turns.length - 1)]!;
      if ('fail' in turn) throw new Error(turn.fail);
      if ('call' in turn) {
        return {
          content: [
            {
              type: 'tool-call',
              toolCallId: `c${i}`,
              toolName: turn.call,
              input: JSON.stringify(turn.input ?? {}),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        };
      }
      const text = 'text' in turn ? turn.text : JSON.stringify(turn.answer);
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
  return { model, prompts, toolsOffered, calls: () => i };
}
