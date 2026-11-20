import { expect, test } from '@playwright/test';
import { generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import type { Verify } from './types';

// The attacks every bearer-token check must survive. Shared by exercise.spec.ts and solution.spec.ts.

const ISSUER = 'https://issuer.lab08.test';
const AUDIENCE = 'order-service';
const ROLE = 'catalog:write';

interface Keys {
  server: { publicKey: CryptoKey; privateKey: CryptoKey };
  stranger: { privateKey: CryptoKey };
}

async function sign(key: CryptoKey, claims: Record<string, unknown>, expiresIn = '5m'): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('catalog-admin')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function registerCases(verify: Verify): void {
  let keys: Keys;

  test.beforeAll(async () => {
    keys = { server: await generateKeyPair('RS256'), stranger: await generateKeyPair('RS256') };
  });

  const check = (token: string) =>
    verify({ token, trustedKey: keys.server.publicKey, audience: AUDIENCE, requiredRole: ROLE });

  test('accepts a valid token from the trusted issuer', async () => {
    await expect(check(await sign(keys.server.privateKey, { roles: [ROLE] }))).resolves.toBe('catalog-admin');
  });

  test('refuses a token without the role', async () => {
    await expect(check(await sign(keys.server.privateKey, { roles: ['catalog:read'] }))).rejects.toThrow();
  });

  test('refuses a token whose claims were edited after signing', async () => {
    const [header, , signature] = (await sign(keys.server.privateKey, { roles: ['catalog:read'] })).split(
      '.',
    );
    const forgedClaims = {
      iss: ISSUER,
      aud: AUDIENCE,
      sub: 'catalog-admin',
      roles: [ROLE],
      exp: Math.floor(Date.now() / 1000) + 300,
    };
    await expect(check(`${header}.${b64(forgedClaims)}.${signature}`)).rejects.toThrow();
  });

  test('refuses an unsigned token (alg: none)', async () => {
    const claims = {
      iss: ISSUER,
      aud: AUDIENCE,
      sub: 'catalog-admin',
      roles: [ROLE],
      exp: Math.floor(Date.now() / 1000) + 300,
    };
    await expect(check(`${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`)).rejects.toThrow();
  });

  test('refuses a token signed by a key the server does not trust', async () => {
    await expect(check(await sign(keys.stranger.privateKey, { roles: [ROLE] }))).rejects.toThrow();
  });
}
