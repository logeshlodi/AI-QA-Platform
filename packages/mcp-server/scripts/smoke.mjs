// Starts the MCP server exactly as .mcp.json tells Claude Code to, then lists and calls its tools
// over stdio. Exit code 1 if anything is missing. Run with `pnpm mcp:smoke`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { command, args } = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers.aiqa;

const client = new Client({ name: 'aiqa-smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command, args, cwd: root, stderr: 'ignore' }));

const { tools } = await client.listTools();
console.log(`tools: ${tools.map((t) => t.name).join(', ')}`);

const text = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) throw new Error(`${name}: ${JSON.stringify(res.content)}`);
  return res.structuredContent;
};
const { runs } = await text('list_runs', { limit: 3 });
console.log(
  `list_runs: ${runs.length} run(s)${runs[0] ? `, latest ${runs[0].suite} ${runs[0].startedAt} pass rate ${runs[0].passRate}%` : ''}`,
);
const { records } = await text('make_test_data', { entity: 'customer', count: 1, seed: 1 });
console.log(`make_test_data: ${records[0].email ?? JSON.stringify(records[0]).slice(0, 60)}`);
const triage = await text('triage_failures', { limit: 3 });
console.log(
  `triage_failures (${triage.model}): ${triage.results.map((r) => `${r.label} ${r.title}`).join('; ') || 'nothing failed in the latest run'}`,
);

await client.close();
if (tools.length !== 7) {
  console.error(`expected 7 tools, got ${tools.length}`);
  process.exit(1);
}
console.log('MCP server answered over stdio.');
