import type { AgentRunRecord, TriageContext, TriageVerdict } from '@aiqa/ai-agents';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One block per failed test: label, why, the evidence and what to do next. */
export function formatTriage(items: { ctx: TriageContext; verdict: TriageVerdict }[], model: string): string {
  if (items.length === 0) return 'Nothing to triage: the run has no failed or flaky tests.';
  const blocks = items.map(({ ctx, verdict }) =>
    [
      `${verdict.label.toUpperCase().padEnd(12)} ${ctx.title}  (${verdict.source}, ${verdict.confidence} confidence)`,
      `  why:   ${verdict.reason}`,
      ...verdict.evidence.map((e) => `  seen:  ${clip(e, 140)}`),
      `  next:  ${verdict.nextStep}`,
    ].join('\n'),
  );
  return [`Model: ${model}`, '', ...blocks].join('\n\n');
}

/** The agent run log, newest first. */
export function formatAgentLog(records: AgentRunRecord[]): string {
  if (records.length === 0) return 'No agent runs logged yet. Try "pnpm aiqa agents triage".';
  const pad = (v: string | number, w: number) => String(v).padEnd(w);
  const head = `${pad('Started (UTC)', 18)}${pad('Agent', 9)}${pad('Source', 8)}${pad('Tools', 7)}${pad('Time', 9)}${pad('Model', 26)}Result`;
  const rows = records.map((r) => {
    const out = r.output as { label?: string } | undefined;
    return `${pad(r.startedAt.replace('T', ' ').slice(0, 16), 18)}${pad(r.agent, 9)}${pad(r.source, 8)}${pad(r.toolCalls.length, 7)}${pad(`${(r.durationMs / 1000).toFixed(1)}s`, 9)}${pad(clip(r.model, 25), 26)}${out?.label ?? ''}${r.fallbackReason && r.source === 'rules' && out?.label === 'unknown' ? ` (${clip(r.fallbackReason, 50)})` : ''}`;
  });
  return [head, ...rows].join('\n');
}
