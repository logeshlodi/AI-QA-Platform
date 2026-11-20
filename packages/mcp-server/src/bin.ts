import fs from 'node:fs';
import path from 'node:path';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { localData } from './defaults';
import { createPlatformServer } from './server';

// An MCP client starts this process without your shell's variables: read the repository's .env if there is one.
const envFile = path.resolve(__dirname, '..', '..', '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// stdout carries the protocol: nothing else may be printed to it. Diagnostics go to stderr.
serveStdio(() => createPlatformServer(localData()));
process.stderr.write('aiqa MCP server ready on stdio\n');
