import { JsonlRunLog, runRecord } from '@aiqa/ai-agents';
import { apiViewer, isAdmin } from '@/lib/api';
import { ApprovalRequest, type PendingWrite } from '@/lib/chat/protocol';
import { QuarantineInput } from '@/lib/chat/tools';
import { config } from '@/lib/config';
import { addQuarantine } from '@/lib/quarantine';
import { unseal } from '@/lib/session';
import { readSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * The only place a change the chat asked for can happen. Anyone in the conversation may refuse; only
 * a platform admin may approve, and only a token sealed for their own session, within ten minutes.
 */
export async function POST(request: Request) {
  const checked = await apiViewer(request);
  if ('response' in checked) return checked.response;
  const { session } = checked;
  const parsed = ApprovalRequest.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: 'bad request' }, { status: 400 });
  const pending = await unseal<PendingWrite>(parsed.data.token);
  if (!pending || pending.sub !== session.sub)
    return Response.json({ error: 'This request expired or belongs to another session.' }, { status: 400 });

  const log = (approved: boolean, fallbackReason?: string) =>
    new JsonlRunLog(config.data.chatLog).write(
      runRecord({
        agent: 'chat-approval',
        model: 'n/a',
        input: { tool: pending.tool, input: pending.input, by: session.name },
        toolCalls: [
          { tool: pending.tool, input: pending.input, status: approved ? 'ok' : 'denied', durationMs: 0 },
        ],
        durationMs: 0,
        source: 'rules',
        fallbackReason,
        output: { approved },
      }),
    );

  if (parsed.data.decision === 'refuse') {
    log(false, 'refused by a person');
    return Response.json({ state: 'denied' });
  }
  if (!isAdmin(session))
    return Response.json({ error: 'Only a platform admin can approve a change.' }, { status: 403 });
  if (!readSettings().chatWritesEnabled)
    return Response.json({
      state: 'failed',
      result: 'changes from the chat are switched off in the admin area',
    });
  if (pending.tool !== 'quarantine_test') return Response.json({ error: 'unknown tool' }, { status: 400 });
  const input = QuarantineInput.safeParse(pending.input);
  if (!input.success)
    return Response.json({ state: 'failed', result: 'the request was not a valid test id and reason' });
  const outcome = addQuarantine({
    ...input.data,
    requestedBy: pending.requestedBy,
    approvedBy: session.name,
    at: new Date().toISOString(),
  });
  log(true);
  return Response.json({
    state: 'approved',
    result:
      outcome === 'added'
        ? `${input.data.testId} is quarantined`
        : `${input.data.testId} was already quarantined`,
  });
}
