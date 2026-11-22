import type { Metadata } from 'next';
import { HealTable } from '@aiqa/dashboard';
import { Frame, PageHead } from '../_components/Frame';
import { loadHeals } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Heal audit' };

export default async function Heals() {
  return (
    <Frame current="/heals">
      <PageHead
        title="Heal audit"
        lede="Every locator the self-healing engine replaced or refused to. Turn one into a patch with pnpm aiqa agents heal-review."
      />
      <HealTable events={loadHeals()} />
    </Frame>
  );
}
