import { formatTime } from '../format';
import type { HealRow } from '../types';
import { EmptyState } from './EmptyState';

const OUTCOME: Record<HealRow['outcome'], string> = {
  healed: 'Healed',
  suggested: 'Suggested only',
  rejected: 'Not healed',
};

/** The self-healing audit trail: which locator broke, what replaced it, and how sure the engine was. */
export function HealTable({ events }: { events: HealRow[] }) {
  if (!events.length)
    return (
      <EmptyState title="No heals recorded">The healer has not had to replace a locator yet.</EmptyState>
    );
  return (
    <div className="aiqa-table-wrap">
      <table className="aiqa-table">
        <caption>Heal audit, newest first</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Locator</th>
            <th scope="col">Original locator</th>
            <th scope="col">Replaced by</th>
            <th scope="col" className="num">
              Score
            </th>
            <th scope="col">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <th scope="row">{formatTime(e.at)}</th>
              <td>{e.locatorKey}</td>
              <td className="aiqa-mono">{e.original}</td>
              <td className="aiqa-mono">{e.healed || '—'}</td>
              <td className="num">{e.score.toFixed(2)}</td>
              <td>
                {OUTCOME[e.outcome]}
                {e.suggestion ? <span className="aiqa-cell-note">{e.suggestion}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
