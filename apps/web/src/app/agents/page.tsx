import type { Metadata } from 'next';
import { AgentRunTable } from '@aiqa/dashboard';
import { Frame, PageHead } from '../_components/Frame';
import { loadAgentRuns } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Agent runs' };

export default async function Agents() {
  return (
    <Frame current="/agents">
      <PageHead
        title="Agent runs"
        lede="The agent run log: which agent ran, whether the model or the rules answered, and how long it took."
      />
      <AgentRunTable runs={loadAgentRuns()} />
    </Frame>
  );
}
