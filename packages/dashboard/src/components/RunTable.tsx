import { formatDuration, formatTime } from '../format';
import type { RunRow } from '../types';
import { EmptyState } from './EmptyState';
import { runStatus, StatusBadge } from './StatusBadge';

export interface RunTableProps {
  runs: RunRow[];
  caption: string;
  /** Link for a run; leave out for plain rows. */
  hrefFor?: (run: RunRow) => string;
}

/** Recorded runs, newest first, one row per run. */
export function RunTable({ runs, caption, hrefFor }: RunTableProps) {
  if (!runs.length)
    return (
      <EmptyState title="No runs recorded yet">
        Run a suite with history on, for example <code>pnpm test:ui</code>.
      </EmptyState>
    );
  return (
    <div className="aiqa-table-wrap">
      <table className="aiqa-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Started</th>
            <th scope="col">Suite</th>
            <th scope="col">Environment</th>
            <th scope="col">Status</th>
            <th scope="col" className="num">
              Passed
            </th>
            <th scope="col" className="num">
              Failed
            </th>
            <th scope="col" className="num">
              Flaky
            </th>
            <th scope="col" className="num">
              Duration
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <th scope="row">
                {hrefFor ? <a href={hrefFor(run)}>{formatTime(run.startedAt)}</a> : formatTime(run.startedAt)}
              </th>
              <td>{run.suite}</td>
              <td>{run.environment}</td>
              <td>
                <StatusBadge status={runStatus(run)} />
              </td>
              <td className="num">{run.passed}</td>
              <td className="num">{run.failed}</td>
              <td className="num">{run.flaky}</td>
              <td className="num">{formatDuration(run.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
