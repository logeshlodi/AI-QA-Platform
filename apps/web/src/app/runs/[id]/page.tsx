import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDuration, formatTime, StatTile, TestTable } from '@aiqa/dashboard';
import { summarize } from '@aiqa/reporting-engine';
import { Frame, PageHead } from '../../_components/Frame';
import { loadRuns, toTestRows } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Run' };

export default async function Run({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = loadRuns().find((r) => r.run.id === decodeURIComponent(id));
  if (!stored) notFound();
  const s = summarize(stored);
  return (
    <Frame current={`/runs/${id}`}>
      <PageHead
        title={`${s.suite} run, ${formatTime(s.startedAt)}`}
        lede={
          <>
            {stored.run.environment}
            {stored.run.branch ? ` · ${stored.run.branch}` : ''}
            {stored.run.gitSha ? ` · ${stored.run.gitSha.slice(0, 7)}` : ''} · <a href="/runs">All runs</a>
          </>
        }
      />
      <section aria-label="Run summary" className="aiqa-tiles">
        <StatTile label="Pass rate" value={`${s.passRate}%`} />
        <StatTile label="Failed" value={String(s.failed)} />
        <StatTile label="Flaky" value={String(s.flaky)} hint="passed on retry" />
        <StatTile label="Duration" value={formatDuration(s.durationMs)} hint={`${s.total} tests`} />
      </section>
      <TestTable tests={toTestRows(stored)} />
    </Frame>
  );
}
