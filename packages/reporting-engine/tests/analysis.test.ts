import { describe, expect, it } from 'vitest';
import { detectFlaky, outcomesOf, renderDashboard, slowest, summarize } from '../src';
import { run } from './helpers';

describe('outcomesOf', () => {
  it('collapses retries into one outcome per test', () => {
    const outcomes = outcomesOf(
      run({ a: ['passed'], b: ['failed', 'passed'], c: ['failed', 'failed'], d: ['skipped'] }).results,
    );
    const by = Object.fromEntries(outcomes.map((o) => [o.testId, o]));
    expect(by.a).toMatchObject({ outcome: 'passed', attempts: 1, errorMessage: undefined });
    expect(by.b).toMatchObject({
      outcome: 'flaky',
      attempts: 2,
      durationMs: 3000,
      errorMessage: 'Error: b broke',
    });
    expect(by.c).toMatchObject({ outcome: 'failed', attempts: 2, failureCategory: 'test' });
    expect(by.d).toMatchObject({ outcome: 'skipped' });
  });

  it('a timed-out last attempt is a failure', () => {
    expect(outcomesOf(run({ a: ['timedOut'] }).results)[0]?.outcome).toBe('failed');
  });
});

describe('summarize', () => {
  it('counts outcomes and leaves skips out of the pass rate', () => {
    const summary = summarize(run({ a: ['passed'], b: ['failed', 'passed'], c: ['failed'], d: ['skipped'] }));
    expect(summary).toMatchObject({ total: 4, passed: 1, flaky: 1, failed: 1, skipped: 1, passRate: 66.7 });
    expect(summary.durationMs).toBe(60_000);
  });

  it('an all-skipped run reports 100%, not a division by zero', () => {
    expect(summarize(run({ a: ['skipped'] })).passRate).toBe(100);
  });
});

describe('detectFlaky', () => {
  it('flags a test that passed only on retry, even in a single run', () => {
    const flaky = detectFlaky([run({ a: ['failed', 'passed'], b: ['passed'] })]);
    expect(flaky.map((f) => f.testId)).toEqual(['a']);
    expect(flaky[0]).toMatchObject({ retriedPasses: 1, runs: 1, score: 1 });
  });

  it('flags green-red-green across runs', () => {
    const history = [run({ a: ['passed'] }), run({ a: ['failed'] }), run({ a: ['passed'] })];
    expect(detectFlaky(history)[0]).toMatchObject({
      testId: 'a',
      flips: 2,
      failures: 1,
      lastOutcome: 'passed',
    });
  });

  it('does not flag a regression that stays red', () => {
    const history = [
      run({ a: ['passed'] }),
      run({ a: ['passed'] }),
      run({ a: ['failed'] }),
      run({ a: ['failed'] }),
    ];
    expect(detectFlaky(history)).toEqual([]);
  });

  it('needs enough runs before counting flips', () => {
    expect(detectFlaky([run({ a: ['passed'] }), run({ a: ['failed'] })], { minRuns: 3 })).toEqual([]);
  });

  it('only looks at the most recent window', () => {
    const old = [run({ a: ['passed'] }), run({ a: ['failed'] }), run({ a: ['passed'] })];
    const recent = [run({ a: ['passed'] }), run({ a: ['passed'] }), run({ a: ['passed'] })];
    expect(detectFlaky([...old, ...recent], { window: 3 })).toEqual([]);
  });

  it('ignores skipped results when counting runs and flips', () => {
    const history = [
      run({ a: ['passed'] }),
      run({ a: ['skipped'] }),
      run({ a: ['passed'] }),
      run({ a: ['passed'] }),
    ];
    expect(detectFlaky(history)).toEqual([]);
  });

  it('ranks the least trustworthy test first', () => {
    const history = [
      run({ a: ['passed'], b: ['failed', 'passed'] }),
      run({ a: ['failed'], b: ['failed', 'passed'] }),
      run({ a: ['passed'], b: ['failed', 'passed'] }),
    ];
    // b passed only on retry in all three runs (score 1); a flipped twice in three runs (score 0.67).
    expect(detectFlaky(history).map((f) => [f.testId, f.score])).toEqual([
      ['b', 1],
      ['a', 0.67],
    ]);
  });
});

describe('slowest', () => {
  it('sorts by total time and leaves skipped tests out', () => {
    const outcomes = outcomesOf(
      run({ a: ['passed'], b: ['failed', 'failed', 'passed'], c: ['skipped'] }).results,
    );
    expect(slowest(outcomes, 5).map((o) => o.testId)).toEqual(['b', 'a']);
  });
});

describe('renderDashboard', () => {
  it('escapes test titles and error text', () => {
    const stored = run({ x: ['failed'] });
    stored.results[0]!.title = '<img src=x onerror=alert(1)>';
    stored.results[0]!.errorMessage = '<script>alert(1)</script>';
    const html = renderDashboard([stored]);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('shows one section per suite, the flaky list and the run log', () => {
    const html = renderDashboard([run({ a: ['failed', 'passed'] }, 'ui'), run({ b: ['passed'] }, 'api')]);
    expect(html).toContain('ui suite');
    expect(html).toContain('api suite');
    expect(html).toContain('Flaky tests');
    expect(html).toContain('Run log');
    expect(html).toContain('2 runs recorded');
  });

  it('renders an empty state with no runs', () => {
    expect(renderDashboard([])).toContain('No runs recorded yet');
  });
});
