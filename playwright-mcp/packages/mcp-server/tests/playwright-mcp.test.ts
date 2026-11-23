// Playwright MCP is set up with every capability, on the repository's own Playwright. Starting the
// server and listing its tools needs no browser, so this runs with the unit tests.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Client } from '@modelcontextprotocol/client';
import { CONFIG, PACKAGE_DIR, TOOL_GROUPS, connectPlaywrightMcp } from './playwright-mcp';

const clients: Client[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) await c.close();
});
async function toolNames(options?: Parameters<typeof connectPlaywrightMcp>[0]): Promise<string[]> {
  const client = await connectPlaywrightMcp(options);
  clients.push(client);
  return (await client.listTools()).tools.map((t) => t.name).sort();
}

describe('Playwright MCP', () => {
  it('runs on the same Playwright as the suites, so there is one set of browsers', () => {
    const version = (pkg: string) =>
      (
        JSON.parse(
          readFileSync(
            require.resolve(`${pkg}/package.json`, {
              paths: [path.join(PACKAGE_DIR, 'node_modules', '@playwright', 'mcp')],
            }),
            'utf8',
          ),
        ) as { version: string }
      ).version;
    expect(version('playwright-core')).toBe('1.65.1');
  });

  it('switches every capability on in the repository config', () => {
    const config = JSON.parse(readFileSync(CONFIG, 'utf8')) as { capabilities: string[] };
    expect([...config.capabilities].sort()).toEqual(Object.keys(TOOL_GROUPS).sort());
  });

  it('exposes every tool of every group with the repository config', async () => {
    const all = Object.values(TOOL_GROUPS).flat();
    expect(await toolNames()).toEqual([...all].sort());
  }, 30_000);

  it('offers only the core tools without the config, so each capability is really an opt-in', async () => {
    expect(await toolNames({ config: false })).toEqual([...TOOL_GROUPS.core].sort());
  }, 30_000);

  it('gives every tool a description and an input schema an agent can follow', async () => {
    const client = await connectPlaywrightMcp();
    clients.push(client);
    for (const tool of (await client.listTools()).tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema.type, tool.name).toBe('object');
    }
  }, 30_000);
});
