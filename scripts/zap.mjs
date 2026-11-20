#!/usr/bin/env node
// OWASP ZAP API scan of the order service (our own service only, never a public site). ZAP reads the
// service's OpenAPI document, so every documented operation is attacked with its parameters and
// bodies: SQL and NoSQL injection, XSS, command injection, path traversal, SSRF and the rest.
//
//   pnpm stack:up && pnpm security:zap
//
// Authenticated: when the stack's Keycloak answers, ZAP sends a catalog-admin token (client zap-scanner,
// valid for an hour) on every request, so the protected PUT /products is attacked behind its auth
// check, not just refused at the door.
//
// infrastructure/security/zap-rules.tsv marks the injection-class rules FAIL; every other alert is
// reported as a warning and does not fail the run. Reports: .aiqa/zap/zap-report.{html,md,json}.
// Exit code: 0 no failures, 1 a FAIL rule fired, 2 Docker or the stack is not running, 3 ZAP itself failed.
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE = 'ghcr.io/zaproxy/zaproxy:stable';
const NETWORK = process.env.ZAP_NETWORK ?? 'aiqa-stack_default';
const TOKEN_URL =
  process.env.AUTH_TOKEN_URL ?? 'http://localhost:8180/realms/aiqa/protocol/openid-connect/token';
const TARGET = process.env.ZAP_TARGET ?? 'http://order-service:8080/openapi.json';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.aiqa', 'zap');

const docker = (args, options = {}) => spawnSync('docker', args, { encoding: 'utf8', ...options });

if (docker(['info', '--format', '{{.ServerVersion}}']).status !== 0) {
  console.error('Docker is not running: start Docker Desktop (or the docker service) and run this again.');
  process.exit(2);
}
if (docker(['network', 'inspect', NETWORK]).status !== 0) {
  console.error(`Docker network ${NETWORK} not found: start the stack first with pnpm stack:up.`);
  process.exit(2);
}

/** A token for the scanner, or undefined when the stack has no Keycloak (the scan then runs anonymous). */
async function scannerToken() {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'zap-scanner',
        client_secret: 'dev-only-zap-scanner-secret', // the local test realm's fixed, published secret
      }),
    });
    return response.ok ? (await response.json()).access_token : undefined;
  } catch {
    return undefined;
  }
}

const token = await scannerToken();
console.log(
  token
    ? 'Scanning as zap-scanner (catalog-admin token from Keycloak).'
    : 'No Keycloak token: scanning anonymously.',
);

mkdirSync(out, { recursive: true });
// The ZAP image runs as its own user; on Linux it needs write access to the mounted folder.
chmodSync(out, 0o777);
copyFileSync(path.join(root, 'infrastructure', 'security', 'zap-rules.tsv'), path.join(out, 'zap-rules.tsv'));

const scan = docker(
  [
    'run',
    '--rm',
    '--network',
    NETWORK,
    ...(token ? ['-e', `ZAP_AUTH_HEADER_VALUE=Bearer ${token}`] : []),
    '-v',
    `${out}:/zap/wrk:rw`,
    IMAGE,
    'zap-api-scan.py',
    '-t',
    TARGET,
    '-f',
    'openapi',
    '-c',
    'zap-rules.tsv',
    '-I', // warnings are reported, not failed: only the rules marked FAIL break the build
    '-r',
    'zap-report.html',
    '-w',
    'zap-report.md',
    '-J',
    'zap-report.json',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
console.log(`\nReports: ${path.relative(root, out)}/zap-report.html (and .md, .json)`);
process.exit(scan.status === 0 || scan.status === 1 ? scan.status : 3);
