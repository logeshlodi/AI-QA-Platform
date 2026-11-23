#!/usr/bin/env node
// `pnpm stack:up`: start the Docker stack and wait until every service is healthy, as
// `docker compose up -d --build --wait` does, with two things it lacks:
//
// - When a service does not come up, it prints why: the state of every container and the last lines
//   of the log of each one that is not healthy. `compose --wait` only says "is unhealthy", and CI
//   stops the stack before anyone can look (Azure DevOps run 20261123.12).
// - It tries once more, without rebuilding. A service that crashed on start (the order service when
//   Kafka's group coordinator is not ready yet) usually comes up on the second try. The first
//   failure and its logs stay in the output, so a retry never hides a real problem; set
//   AIQA_STACK_RETRIES=0 to fail at once.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const COMPOSE = ['compose', '-f', 'infrastructure/docker/stack.compose.yml'];

function docker(args, { capture = false } = {}) {
  const result = spawnSync('docker', [...COMPOSE, ...args], {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? '' };
}

/** Containers that are not running, or running but not (yet) healthy. From `compose ps --format json`. */
export function notHealthy(psJson) {
  const rows = psJson
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    });
  return rows
    .filter((c) => c.State !== 'running' || (c.Health && c.Health !== 'healthy'))
    .map((c) => ({ service: c.Service, state: c.State, health: c.Health || '', status: c.Status }));
}

function explain() {
  console.log('\n[stack] Not every service came up. Container states:');
  docker(['ps', '-a']);
  const ps = docker(['ps', '-a', '--format', 'json'], { capture: true });
  const failing = ps.status === 0 ? notHealthy(ps.stdout) : [];
  for (const { service, state, health } of failing) {
    console.log(`\n[stack] ${service} is ${state}${health ? ` (${health})` : ''}. Its last log lines:`);
    docker(['logs', '--no-color', '--tail', '80', service]);
  }
  return failing;
}

function up(retries) {
  const first = docker(['up', '-d', '--build', '--wait']);
  if (first.status === 0) return 0;
  const failing = explain();
  for (let attempt = 1; attempt <= retries; attempt++) {
    const names = failing.map((f) => f.service).join(', ') || 'the stack';
    console.log(`\n[stack] Trying again (${attempt} of ${retries}) for ${names}, without rebuilding.`);
    const again = docker(['up', '-d', '--wait']);
    if (again.status === 0) {
      console.log('[stack] Up on the retry. The failure above is kept for the record.');
      return 0;
    }
    explain();
  }
  return first.status;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command] = process.argv.slice(2);
  if (command !== 'up') {
    console.error('usage: node scripts/stack.mjs up');
    process.exit(2);
  }
  process.exit(up(Number(process.env.AIQA_STACK_RETRIES ?? 1)));
}
