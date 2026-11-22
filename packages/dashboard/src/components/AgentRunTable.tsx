import { formatDuration, formatTime } from '../format';
import type { AgentRunRow } from '../types';
import { EmptyState } from './EmptyState';

/** The agent run log: who answered (the model or the plain-code rules), how long it took, and why it fell back. */
export function AgentRunTable({ runs }: { runs: AgentRunRow[] }) {
  if (!runs.length)
    return (
      <EmptyState title="No agent runs logged">
        Run an agent, for example <code>pnpm aiqa agents triage</code>.
      </EmptyState>
    );
  return (
    <div className="aiqa-table-wrap">
      <table className="aiqa-table">
        <caption>Agent runs, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Started</th>
            <th scope="col">Agent</th>
            <th scope="col">Answered by</th>
            <th scope="col">Model</th>
            <th scope="col" className="num">
              Tool calls
            </th>
            <th scope="col" className="num">
              Duration
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <th scope="row">{formatTime(r.startedAt)}</th>
              <td>{r.agent}</td>
              <td>
                {r.source === 'model' ? 'Model' : 'Rules (fallback)'}
                {r.fallbackReason ? <span className="aiqa-cell-note">{r.fallbackReason}</span> : null}
              </td>
              <td className="aiqa-mono">{r.model}</td>
              <td className="num">{r.toolCalls}</td>
              <td className="num">{formatDuration(r.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
