import { jwtVerify } from 'jose';
import type { Verify } from './types';

// Lab 08, solved: the signature is checked against the key the server trusts, with the algorithm pinned
// by the server (never taken from the token's header). Only then are the claims believed.

export const verify: Verify = async ({ token, trustedKey, audience, requiredRole }) => {
  const { payload } = await jwtVerify(token, trustedKey, {
    algorithms: ['RS256'],
    issuer: 'https://issuer.lab08.test',
    audience,
  });
  const roles = (payload as { roles?: unknown }).roles;
  if (!Array.isArray(roles) || !roles.includes(requiredRole)) throw new Error('missing role');
  return payload.sub ?? 'unknown';
};
