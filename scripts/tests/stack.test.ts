import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain ESM script with no type declarations
import { notHealthy } from '../stack.mjs';

const pick = notHealthy as (psJson: string) => { service: string; state: string; health: string }[];

// `docker compose ps --format json` prints one object per line (older Compose: one array).
const row = (Service: string, State: string, Health: string) =>
  JSON.stringify({ Service, State, Health, Status: `${State} (${Health})` });

describe('stack: which services to explain when the stack does not come up', () => {
  it('names an unhealthy service, and one that exited, and leaves the healthy ones out', () => {
    const ps = [
      row('postgres', 'running', 'healthy'),
      row('order-service', 'running', 'unhealthy'),
      row('kafka', 'running', 'healthy'),
      row('data-tests', 'exited', ''),
      row('grafana', 'running', ''),
    ].join('\n');
    expect(pick(ps).map((c) => c.service)).toEqual(['order-service', 'data-tests']);
  });

  it('counts a service still starting as not healthy', () => {
    expect(pick(row('keycloak', 'running', 'starting'))).toEqual([
      { service: 'keycloak', state: 'running', health: 'starting', status: 'running (starting)' },
    ]);
  });

  it('reads the older one-array output too', () => {
    const ps = JSON.stringify([
      { Service: 'mongo', State: 'running', Health: 'healthy' },
      { Service: 'order-service', State: 'restarting', Health: '' },
    ]);
    expect(pick(ps).map((c) => c.service)).toEqual(['order-service']);
  });
});
