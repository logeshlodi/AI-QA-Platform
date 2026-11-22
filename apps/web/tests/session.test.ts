import { describe, expect, it } from 'vitest';
import { openSession, rolesOf, safeReturnTo, seal, sealSession, unseal } from '../src/lib/session';

const SECRET = 'unit-test-session-secret-0123456789abcdef';
const viewer = { sub: 'u1', name: 'Dashboard Viewer', roles: ['dashboard-viewer'] };

describe('session cookie', () => {
  it('round-trips a session and cannot be read without the secret', async () => {
    const token = await sealSession(viewer, SECRET);
    expect(token.split('.')).toHaveLength(5); // compact JWE: encrypted, not just signed
    expect(token).not.toContain('Dashboard');
    expect(await openSession(token, SECRET)).toMatchObject(viewer);
    expect(await openSession(token, 'another-secret-another-secret-0000000')).toBeUndefined();
  });

  it('rejects a changed token, a missing one and an expired one', async () => {
    const token = await sealSession(viewer, SECRET);
    const changed = token.slice(0, -6) + (token.endsWith('A') ? 'BBBBBB' : 'AAAAAA');
    expect(await openSession(changed, SECRET)).toBeUndefined();
    expect(await openSession(undefined, SECRET)).toBeUndefined();
    expect(await openSession('', SECRET)).toBeUndefined();
    const expired = await seal(viewer, '-1s', SECRET);
    expect(await unseal(expired, SECRET)).toBeUndefined();
  });
});

describe('safeReturnTo', () => {
  it.each([
    ['/runs/ui-08?x=1', '/runs/ui-08?x=1'],
    ['/', '/'],
    [null, '/'],
    ['', '/'],
    ['runs', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example/', '/'],
    ['/runs\n', '/'],
  ])('%j -> %j', (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});

describe('rolesOf', () => {
  it('reads the roles claim and ignores anything that is not a list of strings', () => {
    expect(rolesOf({ roles: ['dashboard-viewer', 7, 'catalog-admin'] })).toEqual([
      'dashboard-viewer',
      'catalog-admin',
    ]);
    expect(rolesOf({ roles: 'dashboard-viewer' })).toEqual([]);
    expect(rolesOf({})).toEqual([]);
  });
});
