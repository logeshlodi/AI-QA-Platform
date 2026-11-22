import { z } from 'zod';

/** What the browser sends: the conversation so far, newest last. Bounded, so a request stays small. */
export const ChatRequest = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20)
    .refine((m) => m[m.length - 1]?.role === 'user', 'The last message must be the question.'),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ApprovalRequest = z.object({
  token: z.string().min(20).max(8000),
  decision: z.enum(['approve', 'refuse']),
});

/** One line of the streamed answer (newline-delimited JSON). */
export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  | { type: 'approval'; id: string; tool: string; input: unknown; token: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** What an approval token carries: the exact change, for one person, for ten minutes. */
export interface PendingWrite {
  approvalId: string;
  tool: string;
  input: unknown;
  sub: string;
  requestedBy: string;
}

export const line = (event: ChatEvent) => JSON.stringify(event) + '\n';
