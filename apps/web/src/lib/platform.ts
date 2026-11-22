import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { JsonlRunLog, type ModelChoice } from '@aiqa/ai-agents';
// The server alone: the package index also loads defaults for the laptop's own folders.
import { createPlatformServer } from '@aiqa/mcp-server/src/server';
import { config } from './config';
import { loadHealEvents, loadRuns } from './data';

/**
 * The platform's MCP server (packages/mcp-server), connected in-process: the chat uses exactly the
 * tools Claude Code or any other MCP client gets, on this app's data folders.
 */
export async function connectPlatform(
  model: ModelChoice,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createPlatformServer({
    runs: () => loadRuns(),
    heals: () => loadHealEvents(),
    model,
    log: new JsonlRunLog(config.data.agentLog),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'aiqa-web-chat', version: '0.1.0' });
  await client.connect(clientSide);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
