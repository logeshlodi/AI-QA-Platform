import type { Metadata } from 'next';
import { FlakyTable } from '@aiqa/dashboard';
import { Frame, PageHead } from '../_components/Frame';
import { flakyRows, loadRuns } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Flaky tests' };

export default async function Flaky() {
  return (
    <Frame current="/flaky">
      <PageHead
        title="Flaky tests"
        lede="Tests that passed only on a retry, or went green, red, green across runs. The Flaky hunter agent can rerun them: pnpm aiqa agents flaky."
      />
      <FlakyTable tests={flakyRows(loadRuns())} />
    </Frame>
  );
}
