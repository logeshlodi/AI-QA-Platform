import type { Verify } from './types';

// Lab 08: read README.md first. This verifier has one planted design flaw.

export const verify: Verify = async ({ token, audience, requiredRole }) => {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('malformed token');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    sub?: string;
    exp?: number;
    aud?: string | string[];
    roles?: string[];
  };

  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('expired');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) throw new Error('wrong audience');
  if (!claims.roles?.includes(requiredRole)) throw new Error('missing role');
  return claims.sub ?? 'unknown';
};
