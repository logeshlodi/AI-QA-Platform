import type { ReactNode } from 'react';
import type { TestStatus } from '../types';

const LABEL: Record<TestStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  flaky: 'Flaky',
  skipped: 'Skipped',
};

// Each status has its own shape as well as its own colour, so it never rests on colour alone.
const ICON: Record<TestStatus, ReactNode> = {
  passed: <path d="M4.5 9.2l2.8 2.8 6-6.4" />,
  failed: <path d="M5.5 5.5l7 7M12.5 5.5l-7 7" />,
  flaky: <path d="M9 4.5v5.5M9 13v.5" />,
  skipped: <path d="M5 9h8" />,
};

export function StatusBadge({ status }: { status: TestStatus }) {
  return (
    <span className={`aiqa-badge aiqa-badge--${status}`}>
      <svg className="aiqa-badge__icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <circle cx="9" cy="9" r="9" />
        <g>{ICON[status]}</g>
      </svg>
      {LABEL[status]}
    </span>
  );
}

/** A run's status: failed if anything failed, flaky if anything passed only on retry. */
export function runStatus(run: { failed: number; flaky: number }): TestStatus {
  if (run.failed > 0) return 'failed';
  if (run.flaky > 0) return 'flaky';
  return 'passed';
}
