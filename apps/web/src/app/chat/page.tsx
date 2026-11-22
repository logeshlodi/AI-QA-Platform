import type { Metadata } from 'next';
import { isAdmin } from '@/lib/api';
import { Frame, PageHead } from '../_components/Frame';
import { ChatPanel } from './ChatPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Chat' };

export default async function Chat() {
  return (
    <Frame current="/chat">
      {(session) => (
        <>
          <PageHead
            title="Chat"
            lede="Ask about runs, failures, flaky tests, performance and heals. Answers come from the platform's MCP tools; a change the assistant asks for waits for an admin."
          />
          <ChatPanel canApprove={isAdmin(session)} />
        </>
      )}
    </Frame>
  );
}
