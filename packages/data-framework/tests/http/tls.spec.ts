import { X509Certificate } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { expect, test } from '../../src/fixtures';
import { stack } from '../../src/stack';

// The order service over HTTPS, through the stack's TLS edge (infrastructure/docker/edge/Caddyfile).
// What a security review asks of any HTTPS endpoint: only modern TLS, a certificate that fits the
// host and chains to its issuer, plain HTTP redirected, and HSTS so browsers never try HTTP again.
// The certificate authority is private to the stack, so trust is checked here by hand (the leaf's
// signature against its issuer) rather than against the operating system's store.

// The Kubernetes chart has no edge: it says so with EDGE_HTTPS_URL=none, and these tests skip.
const edge = new URL(stack.hasEdge ? stack.edgeHttpsUrl : 'https://localhost:8443');
const plain = new URL(stack.edgeHttpUrl);

interface Handshake {
  protocol: string | null;
  peer: tls.DetailedPeerCertificate;
}

function handshake(options: tls.ConnectionOptions = {}): Promise<Handshake> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: edge.hostname,
      port: Number(edge.port),
      servername: edge.hostname,
      // Trust is checked in the test, against the issuer the server sends (a private CA).
      rejectUnauthorized: false,
      ...options,
    });
    socket.once('secureConnect', () => {
      resolve({ protocol: socket.getProtocol(), peer: socket.getPeerCertificate(true) });
      socket.end();
    });
    socket.once('error', reject);
    socket.setTimeout(5_000, () => socket.destroy(new Error('TLS handshake timed out')));
  });
}

function request(url: URL, lib: typeof http | typeof https): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = lib.request(url, { method: 'GET', rejectUnauthorized: false }, (res) => {
      res.resume();
      resolve(res);
    });
    req.once('error', reject);
    req.end();
  });
}

test.describe('The order service over HTTPS', { tag: '@security' }, () => {
  test.skip(!stack.hasEdge, 'no TLS edge in this environment (the Kubernetes chart has none)');

  test('negotiates TLS 1.3 by default and still accepts TLS 1.2', async () => {
    expect((await handshake()).protocol).toBe('TLSv1.3');
    expect((await handshake({ maxVersion: 'TLSv1.2' })).protocol).toBe('TLSv1.2');
  });

  test('refuses TLS 1.1 and 1.0', async () => {
    // The client must be willing to offer the old versions (security level 0), so the refusal
    // comes from the server and not from Node's own defaults.
    const old = handshake({ minVersion: 'TLSv1', maxVersion: 'TLSv1.1', ciphers: 'DEFAULT:@SECLEVEL=0' });
    const error = await old.then(
      () => undefined,
      (e: NodeJS.ErrnoException) => e,
    );
    test.skip(
      error?.code === 'ERR_SSL_NO_PROTOCOLS_AVAILABLE',
      'this Node build cannot offer TLS 1.1 at all, so the server is never asked',
    );
    expect(error, 'a TLS 1.1 handshake succeeded').toBeDefined();
    expect(`${error!.code} ${error!.message}`).toMatch(
      /PROTOCOL_VERSION|protocol version|UNSUPPORTED_PROTOCOL/i,
    );
  });

  test('presents a current certificate for this host, signed by the issuer it sends', async () => {
    const { peer } = await handshake();
    const leaf = new X509Certificate(peer.raw);
    expect(leaf.checkHost(edge.hostname), `certificate is not valid for ${edge.hostname}`).toBe(
      edge.hostname,
    );
    expect(new Date(leaf.validFrom).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(leaf.validTo).getTime()).toBeGreaterThan(Date.now());

    const issuer = new X509Certificate(peer.issuerCertificate.raw);
    expect(leaf.checkIssued(issuer), 'the leaf names a different issuer').toBe(true);
    expect(leaf.verify(issuer.publicKey), "the leaf is not signed by its issuer's key").toBe(true);
    // Caddy's private authority, not a public CA: the stack never asks the internet for a certificate.
    expect(issuer.subject).toContain('Caddy Local Authority');
  });

  test('redirects plain HTTP to HTTPS permanently, keeping the path and the query', async () => {
    const res = await request(new URL('/health?probe=1', plain), http);
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe(`https://${plain.hostname}:${edge.port}/health?probe=1`);
  });

  test('answers over HTTPS with HSTS, so browsers stop using HTTP for a year', async () => {
    const res = await request(new URL('/health', edge), https);
    expect(res.statusCode).toBe(200);
    const hsts = res.headers['strict-transport-security'] ?? '';
    expect(hsts).toContain('includeSubDomains');
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1])).toBeGreaterThanOrEqual(31_536_000);
  });
});
