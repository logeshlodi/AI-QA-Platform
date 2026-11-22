import type { Metadata } from 'next';
import { EmptyState, TrendChart } from '@aiqa/dashboard';
import { Frame, PageHead, SuitePicker } from '../_components/Frame';
import { loadRuns, suitesOf, suiteTrends } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Trends' };

export default async function Trends({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const runs = loadRuns();
  const suites = suitesOf(runs);
  const requested = (await searchParams).suite;
  const suite =
    requested && suites.includes(requested) ? requested : suites.includes('ui') ? 'ui' : suites[0];
  const trend = suite ? suiteTrends(runs, suite) : undefined;
  return (
    <Frame current="/trends">
      <PageHead title="Trends" lede="Pass rate and duration over the last 20 runs of a suite." />
      <SuitePicker suites={suites} current={suite} base="/trends" />
      {trend ? (
        <div className="aiqa-grid-2">
          <TrendChart
            title={`Pass rate, ${suite} suite`}
            unit="%"
            points={trend.passRate}
            min={0}
            max={100}
          />
          <TrendChart title={`Duration, ${suite} suite`} unit=" s" points={trend.duration} />
        </div>
      ) : (
        <EmptyState title="No runs recorded yet" />
      )}
    </Frame>
  );
}
