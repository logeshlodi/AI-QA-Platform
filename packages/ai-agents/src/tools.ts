import type { z } from 'zod';

/**
 * What an agent may call. `read` tools run freely; `write` tools change something outside the
 * agent (a file, a branch, a message) and run only after a person approves the exact call.
 */
export interface AgentTool<I = unknown, O = unknown> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  kind: 'read' | 'write';
  run(input: I): Promise<O>;
}

/** Keeps the tool's input type while it sits in a list of tools of other types. */
export const defineTool = <I, O>(tool: AgentTool<I, O>): AgentTool => tool as unknown as AgentTool;

export interface ToolCallRequest {
  agent: string;
  tool: string;
  input: unknown;
}

/** Answers whether a write may go ahead. The CLI asks on the terminal; the chat app shows a button. */
export type Approver = (call: ToolCallRequest) => Promise<boolean>;

/** The safe default: no person present, no writes. */
export const denyWrites: Approver = async () => false;
