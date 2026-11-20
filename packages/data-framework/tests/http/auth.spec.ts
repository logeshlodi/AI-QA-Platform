import type { APIResponse } from '@playwright/test';
import { claimsOf, clientToken, CLIENTS } from '../../src/auth';
import { expect, freshProducts, test } from '../../src/fixtures';

// PUT /products/{sku} needs a Keycloak access token for this service with the catalog-admin role.
// Real tokens from the stack's Keycloak, real refusals from the service: no token, a token without the
// role, for another API, expired, altered after signing, unsigned. Every refusal must also leave the
// catalogue untouched and match the 401/403 answers the OpenAPI document lists.

test.describe('Product API authorization (OAuth 2.0 bearer tokens from Keycloak)', { tag: '@auth' }, () => {
  test.beforeEach(({ authEnabled }) => {
    test.skip(
      !authEnabled,
      'this stack runs the order service without auth (no Keycloak), e.g. the kind cluster',
    );
  });

  const product = { name: 'Auth test lamp', priceCents: 4200, stock: 3 };
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

  async function expectRefused(
    response: APIResponse,
    status: 401 | 403,
    error: string | undefined,
    description: RegExp,
  ) {
    expect(response.status()).toBe(status);
    const challenge = response.headers()['www-authenticate'] ?? '';
    expect(challenge).toMatch(/^Bearer realm="order-service"/);
    if (error) expect(challenge).toContain(`error="${error}"`);
    else expect(challenge).not.toContain('error=');
    expect((await response.json()).error).toMatch(description);
  }

  test.afterEach(async ({ db, seed }) => {
    // A refused write must not have created anything; a successful one is cleaned up.
    const [p] = freshProducts(seed, 1);
    await db.query('DELETE FROM products WHERE sku = $1', [p!.sku]);
  });

  test('a catalog-admin token creates, then replaces, a product', async ({
    catalogAdmin,
    contract,
    seed,
  }) => {
    const [p] = freshProducts(seed, 1);
    const created = await catalogAdmin.put(`/products/${p!.sku}`, { data: product });
    expect(created.status()).toBe(201);
    expect((await catalogAdmin.put(`/products/${p!.sku}`, { data: { ...product, stock: 4 } })).status()).toBe(
      200,
    );
    expect((await contract.check('PUT', '/products/{sku}', created)).problems).toEqual([]);
  });

  test('no token: 401 with a bare challenge, nothing written', async ({ service, contract, db, seed }) => {
    const [p] = freshProducts(seed, 1);
    const response = await service.put(`/products/${p!.sku}`, { data: product });
    await expectRefused(response, 401, undefined, /bearer token is required/);
    expect((await contract.check('PUT', '/products/{sku}', response)).problems).toEqual([]);
    expect((await db.query('SELECT 1 FROM products WHERE sku = $1', [p!.sku])).rowCount).toBe(0);
  });

  test('not a bearer token: Basic credentials and garbage are refused', async ({ service, seed }) => {
    const [p] = freshProducts(seed, 1);
    const basic = await service.put(`/products/${p!.sku}`, {
      data: product,
      headers: { authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` },
    });
    await expectRefused(basic, 401, 'invalid_token', /must be "Bearer <token>"/);
    const garbage = await service.put(`/products/${p!.sku}`, { data: product, headers: bearer('not-a-jwt') });
    await expectRefused(garbage, 401, 'invalid_token', /not valid/);
  });

  test('a valid token without the catalog-admin role: 403, not 401', async ({
    service,
    contract,
    db,
    seed,
  }) => {
    const token = await clientToken(CLIENTS.storefront);
    expect(claimsOf(token).aud).toContain('order-service'); // a perfectly good token for this service...
    const [p] = freshProducts(seed, 1);
    const response = await service.put(`/products/${p!.sku}`, { data: product, headers: bearer(token) });
    await expectRefused(response, 403, 'insufficient_scope', /catalog-admin role is required/); // ...without the right
    expect((await contract.check('PUT', '/products/{sku}', response)).problems).toEqual([]);
    expect((await db.query('SELECT 1 FROM products WHERE sku = $1', [p!.sku])).rowCount).toBe(0);
  });

  test('a token issued for another API is refused, even with the role', async ({ service, seed }) => {
    const token = await clientToken(CLIENTS.otherApi);
    expect(claimsOf(token).aud).toBe('other-api');
    const [p] = freshProducts(seed, 1);
    const response = await service.put(`/products/${p!.sku}`, { data: product, headers: bearer(token) });
    await expectRefused(response, 401, 'invalid_token', /aud is not accepted/);
  });

  test('a token works until it expires, then is refused', async ({ service, seed }) => {
    const token = await clientToken(CLIENTS.shortLived); // this client's tokens live for 2 seconds
    const [p] = freshProducts(seed, 1);
    const put = () => service.put(`/products/${p!.sku}`, { data: product, headers: bearer(token) });
    expect((await put()).status()).toBe(201);
    await expect.poll(async () => (await put()).status(), { timeout: 10_000, intervals: [500] }).toBe(401);
    await expectRefused(await put(), 401, 'invalid_token', /expired/);
  });

  test('claims changed after signing: the signature no longer matches', async ({ service, seed }) => {
    const [header, , signature] = (await clientToken(CLIENTS.storefront)).split('.');
    const claims = claimsOf(await clientToken(CLIENTS.storefront));
    const promoted = b64({ ...claims, realm_access: { roles: ['catalog-admin'] } }); // grant ourselves the role
    const [p] = freshProducts(seed, 1);
    const response = await service.put(`/products/${p!.sku}`, {
      data: product,
      headers: bearer(`${header}.${promoted}.${signature}`),
    });
    await expectRefused(response, 401, 'invalid_token', /signature is invalid/);
  });

  test('an unsigned token (alg "none") with every right claim is refused', async ({ service, seed }) => {
    const claims = claimsOf(await clientToken(CLIENTS.catalogAdmin));
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
    const [p] = freshProducts(seed, 1);
    const response = await service.put(`/products/${p!.sku}`, { data: product, headers: bearer(unsigned) });
    await expectRefused(response, 401, 'invalid_token', /not valid|algorithm/);
  });

  test('reading and ordering stay open', async ({ service }) => {
    expect((await service.get('/health')).status()).toBe(200);
    expect((await service.get(`/orders/${crypto.randomUUID()}`)).status()).toBe(404); // no 401: reads need no token
  });
});
