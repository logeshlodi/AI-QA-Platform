import { randomUUID } from 'node:crypto';
import { chooseModel, JsonlRunLog, runRecord } from '@aiqa/ai-agents';
import { loadEnv } from '@aiqa/shared';
import { isStepCount, streamText, type ToolSet } from 'ai';
import { apiViewer } from '@/lib/api';
import { line, type ChatEvent, ChatRequest } from '@/lib/chat/protocol';
import { mcpTools, SYSTEM, WRITE_TOOLS, writeTools } from '@/lib/chat/tools';
import { config } from '@/lib/config';
import { connectPlatform } from '@/lib/platform';
import { seal } from '@/lib/session';
import { readSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Answers a question with the platform's MCP tools, streamed as newline-delimited JSON events.
 * A write tool call is not run: it becomes an `approval` event carrying a sealed token, and only the
 * approval route can carry it out, for an admin.
 */
export async function POST(request: Request) {
  const checked = await apiViewer(request);
  if ('response' in checked) return checked.response;
  const { session } = checked;
  const parsed = ChatRequest.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success)
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'bad request' }, { status: 400 });

  const settings = readSettings();
  const model = chooseModel(loadEnv());
  const encoder = new TextEncoder();
  const started = Date.now();
  const toolCalls: { tool: string; input: unknown; status: 'ok' | 'denied'; durationMs: number }[] = [];

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(line(event)));
      if (!model.model) {
        send({
          type: 'text',
          text: 'No model is configured, so the chat cannot answer. Set AI_ENABLED=true for the local Ollama model, or AGENT_PROVIDER=openai-compatible with AGENT_BASE_URL and AGENT_MODEL, and restart the app.',
        });
        send({ type: 'done' });
        controller.close();
        return;
      }
      const platform = await connectPlatform(model);
      let fallbackReason: string | undefined;
      try {
        const tools: ToolSet = {
          ...(await mcpTools(platform.client)),
          ...(settings.chatWritesEnabled ? writeTools() : {}),
        };
        const result = streamText({
          model: model.model,
          system: SYSTEM,
          messages: parsed.data.messages,
          tools,
          stopWhen: isStepCount(settings.chatMaxSteps),
          toolApproval: Object.fromEntries(WRITE_TOOLS.map((name) => [name, 'user-approval' as const])),
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(settings.chatTimeoutSec * 1000)]),
        });
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') send({ type: 'text', text: part.text });
          else if (part.type === 'tool-call' && !(WRITE_TOOLS as readonly string[]).includes(part.toolName)) {
            send({ type: 'tool', name: part.toolName, input: part.input });
            toolCalls.push({ tool: part.toolName, input: part.input, status: 'ok', durationMs: 0 });
          } else if (part.type === 'tool-approval-request') {
            const pending = {
              approvalId: part.approvalId,
              tool: part.toolCall.toolName,
              input: part.toolCall.input,
              sub: session.sub,
              requestedBy: session.name,
            };
            toolCalls.push({ tool: pending.tool, input: pending.input, status: 'denied', durationMs: 0 });
            send({
              type: 'approval',
              id: part.approvalId,
              tool: pending.tool,
              input: pending.input,
              token: await seal(pending, '10m'),
            });
          } else if (part.type === 'error') {
            fallbackReason = String((part.error as Error)?.message ?? part.error).split('\n')[0];
            send({ type: 'error', message: `The model failed: ${fallbackReason}` });
          }
        }
      } catch (error) {
        if (!request.signal.aborted) {
          fallbackReason = (error as Error).message.split('\n')[0];
          send({ type: 'error', message: `The model failed: ${fallbackReason}` });
        }
      } finally {
        await platform.close();
        new JsonlRunLog(config.data.chatLog).write(
          runRecord({
            agent: 'chat',
            model: model.label,
            input: { question: parsed.data.messages.at(-1)?.content.slice(0, 200), by: session.name },
            toolCalls: toolCalls.map((c) => ({ ...c })),
            durationMs: Date.now() - started,
            source: fallbackReason ? 'rules' : 'model',
            fallbackReason: fallbackReason ?? (request.signal.aborted ? 'stopped by the person' : undefined),
            output: null,
          }),
        );
        if (!request.signal.aborted) send({ type: 'done' });
        try {
          controller.close();
        } catch {
          // the browser already went away
        }
      }
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Request-Id': randomUUID(),
    },
  });
}
