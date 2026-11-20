import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { authConfigFromEnv, challenge, createAuthorizer, type Authorizer } from '../src/auth';

// Every way a bearer token can be wrong, checked without Keycloak: the test signs its own tokens with
// a key pair it generates, and gives the authorizer that key set in place of the remote JWKS. The
// stack's auth spec does the same against a real Keycloak.

const ISSUER = 'http://localhost:8180/realms/aiqa';
const config = { issuer: ISSUER, audience: 'order-service', jwksUrl: 'unused' };
const ROLE = 'catalog-admin';

let trusted: { privateKey: CryptoKey; jwk: JWK };
let attacker: { privateKey: CryptoKey };
let authorize: Authorizer;

async function token(
  claims: Record<string, unknown> = {},
  {
    key = trusted.privateKey,
    kid = 'trusted',
    expiresIn = '5m',
  }: { key?: CryptoKey; kid?: string; expiresIn?: string } = {},
): Promise<string> {
  // Defaults first, so a test can override any claim (an issuer, an audience) by passing it.
  return new SignJWT({
    iss: ISSUER,
    aud: 'order-service',
    sub: 'service-account-catalog-admin-cli',
    realm_access: { roles: [ROLE] },
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  trusted = {
    privateKey: pair.privateKey,
    jwk: { ...(await exportJWK(pair.publicKey)), kid: 'trusted', alg: 'RS256', use: 'sig' },
  };
  attacker = { privateKey: (await generateKeyPair('RS256')).privateKey };
  authorize = createAuthorizer(config, createLocalJWKSet({ keys: [trusted.jwk] }));
});

describe('bearer-token checks', () => {
  it('lets a valid token with the role through', async () => {
    expect(await authorize(`Bearer ${await token()}`, ROLE)).toEqual({
      ok: true,
      subject: 'service-account-catalog-admin-cli',
    });
  });

  it('asks for a token when there is none, without an error code', async () => {
    const result = await authorize(undefined, ROLE);
    expect(result).toMatchObject({ ok: false, status: 401, error: undefined });
    if (!result.ok) expect(challenge(result)).toBe('Bearer realm="order-service"');
  });

  it('refuses a header that is not "Bearer <token>"', async () => {
    expect(await authorize(`Basic ${Buffer.from('admin:admin').toString('base64')}`, ROLE)).toMatchObject({
      status: 401,
      error: 'invalid_token',
    });
    expect(await authorize('Bearer not a token', ROLE)).toMatchObject({
      status: 401,
      error: 'invalid_token',
    });
  });

  it('answers 403, not 401, for a valid token without the role', async () => {
    const result = await authorize(`Bearer ${await token({ realm_access: { roles: ['shopper'] } })}`, ROLE);
    expect(result).toMatchObject({ ok: false, status: 403, error: 'insufficient_scope' });
    if (!result.ok) expect(challenge(result)).toContain('error="insufficient_scope"');
  });

  it('refuses an expired token', async () => {
    const expired = await token({}, { expiresIn: '-1s' });
    expect(await authorize(`Bearer ${expired}`, ROLE)).toMatchObject({
      status: 401,
      description: 'the token has expired',
    });
  });

  it('refuses a token for another audience or from another issuer', async () => {
    const otherApi = await new SignJWT({ realm_access: { roles: [ROLE] } })
      .setProtectedHeader({ alg: 'RS256', kid: 'trusted' })
      .setIssuer(ISSUER)
      .setAudience('other-api')
      .setExpirationTime('5m')
      .sign(trusted.privateKey);
    expect(await authorize(`Bearer ${otherApi}`, ROLE)).toMatchObject({
      status: 401,
      description: "the token's aud is not accepted",
    });
    const otherIssuer = await token({ iss: 'http://evil.example/realms/aiqa' });
    expect(await authorize(`Bearer ${otherIssuer}`, ROLE)).toMatchObject({
      status: 401,
      description: "the token's iss is not accepted",
    });
  });

  it('refuses a token whose claims were changed after signing', async () => {
    const [header, , signature] = (await token({ realm_access: { roles: ['shopper'] } })).split('.');
    const forged = `${header}.${b64({ iss: ISSUER, aud: 'order-service', exp: Math.floor(Date.now() / 1000) + 300, realm_access: { roles: [ROLE] } })}.${signature}`;
    expect(await authorize(`Bearer ${forged}`, ROLE)).toMatchObject({
      status: 401,
      description: 'the token signature is invalid',
    });
  });

  it('refuses a token signed with somebody else’s key', async () => {
    const ownKey = await token({}, { key: attacker.privateKey, kid: 'trusted' });
    expect(await authorize(`Bearer ${ownKey}`, ROLE)).toMatchObject({ status: 401, error: 'invalid_token' });
    const unknownKid = await token({}, { key: attacker.privateKey, kid: 'attacker' });
    expect(await authorize(`Bearer ${unknownKid}`, ROLE)).toMatchObject({
      status: 401,
      error: 'invalid_token',
    });
  });

  it('refuses an unsigned token (alg "none")', async () => {
    const payload = {
      iss: ISSUER,
      aud: 'order-service',
      exp: Math.floor(Date.now() / 1000) + 300,
      realm_access: { roles: [ROLE] },
    };
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
    expect(await authorize(`Bearer ${unsigned}`, ROLE)).toMatchObject({
      status: 401,
      error: 'invalid_token',
    });
  });

  it('refuses an HS256 token keyed with the public key (algorithm confusion)', async () => {
    const publicKeyAsSecret = new TextEncoder().encode(JSON.stringify(trusted.jwk));
    const confused = await new SignJWT({ realm_access: { roles: [ROLE] } })
      .setProtectedHeader({ alg: 'HS256', kid: 'trusted' })
      .setIssuer(ISSUER)
      .setAudience('order-service')
      .setExpirationTime('5m')
      .sign(publicKeyAsSecret);
    expect(await authorize(`Bearer ${confused}`, ROLE)).toMatchObject({
      status: 401,
      error: 'invalid_token',
    });
  });
});

describe('auth configuration', () => {
  it('is off without AUTH_ISSUER, and derives the JWKS URL from the issuer', () => {
    expect(authConfigFromEnv({})).toBeUndefined();
    expect(authConfigFromEnv({ AUTH_ISSUER: ISSUER })).toEqual({
      issuer: ISSUER,
      audience: 'order-service',
      jwksUrl: `${ISSUER}/protocol/openid-connect/certs`,
    });
  });
});
