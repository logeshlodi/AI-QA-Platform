#!/usr/bin/env node
// Scans pnpm-lock.yaml for known vulnerabilities with OSV-Scanner (Apache-2.0), run from its official
// Docker image so the laptop and CI use the same version. Ignored findings, with reasons and expiry
// dates, are in osv-scanner.toml. Exit code: 0 clean, 1 vulnerabilities found, other = the scan failed.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE = 'ghcr.io/google/osv-scanner:v2.5.1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Docker not running also exits 1, which would read as "vulnerabilities found": check first.
const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
if (docker.error || docker.status !== 0) {
  console.error('Docker is not running: start Docker Desktop (or the docker service) and run this again.');
  process.exit(2);
}

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '-v',
    `${root}:/src:ro`,
    IMAGE,
    'scan',
    'source',
    '--config=/src/osv-scanner.toml',
    '--lockfile=/src/pnpm-lock.yaml',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error(`could not run docker: ${result.error.message}`);
  process.exit(2);
}
process.exit(result.status ?? 2);
