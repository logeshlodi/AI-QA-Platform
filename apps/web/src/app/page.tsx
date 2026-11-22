import { formatPercent, RunTable, StatTile, TrendChart } from '@aiqa/dashboard';
import { summarize } from '@aiqa/reporting-engine';
import { Frame, PageHead } from './_components/Frame';
import { flakyRows, loadAgentRuns, loadHeals, loadRuns, suitesOf, suiteTrends, toRunRow } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  const runs = loadRuns();
  const latestBySuite = suitesOf(runs).map((suite) => runs.find((r) => r.run.suite === suite)!);
  const suites = suitesOf(runs);
  // The UI suite is the headline when it exists; otherwise the suite that ran last.
  const main = suites.includes('ui') ? 'ui' : runs[0]?.run.suite;
  const trend = main ? suiteTrends(runs, main) : undefined;
  const flaky = flakyRows(runs);
  const heals = loadHeals();
  const agents = loadAgentRuns();
  const modelShare = agents.length
    ? formatPercent(agents.filter((a) => a.source === 'model').length, agents.length)
    : '–';
  return (
    <Frame current="/">
      <PageHead title="Overview" lede="The latest run of each suite, and what needs a look." />
      <section aria-label="Latest run of each suite" className="aiqa-tiles">
        {latestBySuite.length ? (
          latestBySuite.map((r) => {
            const s = summarize(r);
            return (
              <StatTile
                key={s.suite}
                label={`${s.suite}: pass rate`}
                value={`${s.passRate}%`}
                hint={`${s.failed} failed · ${s.flaky} flaky · ${s.total} tests`}
              />
            );
          })
        ) : (
          <StatTile label="Runs recorded" value="0" />
        )}
        <StatTile label="Flaky tests" value={String(flaky.length)} hint="across the recorded runs" />
        <StatTile label="Heals recorded" value={String(heals.length)} />
        <StatTile
          label="Agent runs answered by the model"
          value={modelShare}
          hint={`${agents.length} runs logged`}
        />
      </section>
      {trend ? (
        <TrendChart title={`Pass rate, ${main} suite`} unit="%" points={trend.passRate} min={0} max={100} />
      ) : null}
      <RunTable
        runs={runs.slice(0, 10).map(toRunRow)}
        caption="Latest runs"
        hrefFor={(r) => `/runs/${encodeURIComponent(r.id)}`}
      />
    </Frame>
  );
}
