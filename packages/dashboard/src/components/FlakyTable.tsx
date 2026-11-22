import { formatPercent, formatTime } from '../format';
import type { FlakyRow } from '../types';
import { EmptyState } from './EmptyState';

/** Tests that passed only on retry or flipped between runs, worst first. */
export function FlakyTable({ tests }: { tests: FlakyRow[] }) {
  if (!tests.length)
    return (
      <EmptyState title="No flaky tests in the recorded runs">
        Every test passed or failed the same way each time.
      </EmptyState>
    );
  const sorted = [...tests].sort((a, b) => b.flakyRuns / b.runs - a.flakyRuns / a.runs);
  return (
    <div className="aiqa-table-wrap">
      <table className="aiqa-table">
        <caption>Flaky tests, worst first</caption>
        <thead>
          <tr>
            <th scope="col">Test</th>
            <th scope="col">File</th>
            <th scope="col" className="num">
              Flaky runs
            </th>
            <th scope="col" className="num">
              Share
            </th>
            <th scope="col">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.testId}>
              <th scope="row">{t.title}</th>
              <td className="aiqa-mono">{t.file}</td>
              <td className="num">
                {t.flakyRuns} of {t.runs}
              </td>
              <td className="num">{formatPercent(t.flakyRuns, t.runs)}</td>
              <td>{formatTime(t.lastSeen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
