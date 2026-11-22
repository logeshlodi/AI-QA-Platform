import type { Metadata } from 'next';
import { RunTable } from '@aiqa/dashboard';
import { Frame, PageHead, SuitePicker } from '../_components/Frame';
import { loadRuns, suitesOf, toRunRow } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Runs' };

export default async function Runs({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const runs = loadRuns();
  const shown = suite ? runs.filter((r) => r.run.suite === suite) : runs;
  return (
    <Frame current="/runs">
      <PageHead title="Runs" lede="Every recorded run, newest first. Open one to see its tests." />
      <SuitePicker suites={suitesOf(runs)} current={suite} base="/runs" />
      <RunTable
        runs={shown.map(toRunRow)}
        caption={suite ? `Runs of the ${suite} suite` : 'All runs'}
        hrefFor={(r) => `/runs/${encodeURIComponent(r.id)}`}
      />
    </Frame>
  );
}
