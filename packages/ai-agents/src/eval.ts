/** One labelled example: what goes in and the answer a person gave. */
export interface EvalCase<I, L extends string> {
  id: string;
  input: I;
  expected: L;
  /** Why this label, in a person's words. */
  note?: string;
}

export interface EvalOutcome<L extends string> {
  id: string;
  expected: L;
  actual: L | 'unknown';
  correct: boolean;
  /** Where the answer came from, e.g. "rules" or "model". */
  source: string;
}

export interface EvalReport<L extends string> {
  total: number;
  correct: number;
  /** correct / total, 0 to 1. An "unknown" answer counts as wrong. */
  accuracy: number;
  /** expected label -> actual label -> count. */
  confusion: Record<string, Record<string, number>>;
  bySource: Record<string, { total: number; correct: number }>;
  outcomes: EvalOutcome<L>[];
}

/** Runs every case one after another (a local model serves one request at a time anyway). */
export async function runEval<I, L extends string>(
  cases: readonly EvalCase<I, L>[],
  answer: (input: I) => Promise<{ label: L | 'unknown'; source: string }>,
): Promise<EvalReport<L>> {
  const outcomes: EvalOutcome<L>[] = [];
  for (const c of cases) {
    const { label, source } = await answer(c.input);
    outcomes.push({ id: c.id, expected: c.expected, actual: label, correct: label === c.expected, source });
  }
  const confusion: Record<string, Record<string, number>> = {};
  const bySource: Record<string, { total: number; correct: number }> = {};
  for (const o of outcomes) {
    const row = (confusion[o.expected] ??= {});
    row[o.actual] = (row[o.actual] ?? 0) + 1;
    const s = (bySource[o.source] ??= { total: 0, correct: 0 });
    s.total++;
    if (o.correct) s.correct++;
  }
  const correct = outcomes.filter((o) => o.correct).length;
  return {
    total: outcomes.length,
    correct,
    accuracy: outcomes.length ? correct / outcomes.length : 0,
    confusion,
    bySource,
    outcomes,
  };
}

export function formatEval<L extends string>(name: string, report: EvalReport<L>): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines = [`${name}: ${report.correct} of ${report.total} correct (${pct(report.accuracy)})`];
  for (const [source, s] of Object.entries(report.bySource)) {
    lines.push(`  answered by ${source.padEnd(8)} ${s.correct}/${s.total}`);
  }
  const wrong = report.outcomes.filter((o) => !o.correct);
  if (wrong.length) {
    lines.push('', '  Wrong:');
    for (const o of wrong)
      lines.push(`    ${o.id.padEnd(28)} expected ${o.expected.padEnd(12)} got ${o.actual} (${o.source})`);
  }
  return lines.join('\n');
}
