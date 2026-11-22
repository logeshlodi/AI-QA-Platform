'use client';
import { useState } from 'react';
import { formatDuration } from '../format';
import type { TestRow, TestStatus } from '../types';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';

const FILTERS: { value: 'all' | TestStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'failed', label: 'Failed' },
  { value: 'flaky', label: 'Flaky' },
  { value: 'passed', label: 'Passed' },
  { value: 'skipped', label: 'Skipped' },
];

/** The tests of one run, failures first, with a status filter. */
export function TestTable({ tests }: { tests: TestRow[] }) {
  const [filter, setFilter] = useState<'all' | TestStatus>('all');
  const order: Record<TestStatus, number> = { failed: 0, flaky: 1, passed: 2, skipped: 3 };
  const shown = tests
    .filter((t) => filter === 'all' || t.status === filter)
    .sort((a, b) => order[a.status] - order[b.status] || a.title.localeCompare(b.title));
  const count = (s: 'all' | TestStatus) =>
    s === 'all' ? tests.length : tests.filter((t) => t.status === s).length;
  return (
    <section aria-labelledby="tests-heading">
      <div className="aiqa-toolbar">
        <h2 id="tests-heading">Tests</h2>
        <fieldset className="aiqa-filter">
          <legend className="aiqa-visually-hidden">Show tests</legend>
          {FILTERS.map((f) => (
            <label key={f.value} className={filter === f.value ? 'is-active' : undefined}>
              <input
                type="radio"
                name="test-filter"
                value={f.value}
                checked={filter === f.value}
                onChange={() => setFilter(f.value)}
              />
              {f.label} ({count(f.value)})
            </label>
          ))}
        </fieldset>
      </div>
      {shown.length ? (
        <ul className="aiqa-tests">
          {shown.map((t) => (
            <li key={t.id} className="aiqa-test">
              <div className="aiqa-test__head">
                <StatusBadge status={t.status} />
                <span className="aiqa-test__title">{t.title}</span>
                <span className="aiqa-test__meta">
                  {t.project} · {formatDuration(t.durationMs)}
                  {t.retries ? ` · ${t.retries} ${t.retries === 1 ? 'retry' : 'retries'}` : ''}
                </span>
              </div>
              <p className="aiqa-test__file">{t.file}</p>
              {t.error ? <pre className="aiqa-test__error">{t.error}</pre> : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No tests with this status" />
      )}
    </section>
  );
}
