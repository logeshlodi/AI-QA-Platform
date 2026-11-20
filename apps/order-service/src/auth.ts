import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

/**
 * Bearer-token checks for the endpoints that change data (RFC 6750). Tokens are JWTs from Keycloak,
 * checked against its published signing keys: signature, expiry, issuer, audience and the required
 * realm role. Off when AUTH_ISSUER is unset (the Kubernetes chart has no Keycloak), on in the Docker stack.
 */
export interface AuthConfig {
  /** The `iss` every token must carry, e.g. http://localhost:8180/realms/aiqa. */
  issuer: string;
  /** The `aud` every token must carry: this service's name. */
  audience: string;
  /** Where the signing keys are fetched from; inside Docker this is not the issuer's host. */
  jwksUrl: string;
}

export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig | undefined {
  const issuer = env.AUTH_ISSUER;
  if (!issuer) return undefined;
  return {
    issuer,
    audience: env.AUTH_AUDIENCE ?? 'order-service',
    jwksUrl: env.AUTH_JWKS_URL ?? `${issuer}/protocol/openid-connect/certs`,
  };
}

export type AuthResult =
  | { ok: true; subject: string | undefined }
  | {
      ok: false;
      status: 401 | 403;
      error: 'invalid_token' | 'insufficient_scope' | undefined;
      description: string;
    };

export type Authorizer = (authorization: string | undefined, role: string) => Promise<AuthResult>;

const unauthorized = (description: string): AuthResult => ({
  ok: false,
  status: 401,
  error: 'invalid_token',
  description,
});

/** No credentials at all: a bare challenge, no error code (RFC 6750 section 3.1). */
const noCredentials: AuthResult = {
  ok: false,
  status: 401,
  error: undefined,
  description: 'a bearer token is required',
};

/** Keycloak puts realm roles in realm_access.roles. */
const rolesOf = (payload: JWTPayload): string[] => {
  const access = payload.realm_access as { roles?: unknown } | undefined;
  return Array.isArray(access?.roles) ? access.roles.filter((r): r is string => typeof r === 'string') : [];
};

/** `keys` is injectable so unit tests can sign their own tokens; production fetches and caches the JWKS. */
export function createAuthorizer(
  config: AuthConfig,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(config.jwksUrl)),
): Authorizer {
  return async (authorization, role) => {
    if (!authorization) return noCredentials;
    const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(authorization);
    if (!match) return unauthorized('the Authorization header must be "Bearer <token>"');

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(match[1]!, keys, {
        issuer: config.issuer,
        audience: config.audience,
        // Only the algorithm Keycloak signs with: never "none", never a symmetric one an attacker can forge.
        algorithms: ['RS256'],
      }));
    } catch (error) {
      if (error instanceof errors.JWTExpired) return unauthorized('the token has expired');
      if (error instanceof errors.JWTClaimValidationFailed)
        return unauthorized(`the token's ${error.claim} is not accepted`);
      if (error instanceof errors.JWSSignatureVerificationFailed)
        return unauthorized('the token signature is invalid');
      if (error instanceof errors.JWKSNoMatchingKey)
        return unauthorized('the token was not signed by a trusted key');
      if (error instanceof errors.JOSEAlgNotAllowed)
        return unauthorized('the token algorithm is not accepted');
      return unauthorized('the token is not valid');
    }

    if (!rolesOf(payload).includes(role)) {
      return {
        ok: false,
        status: 403,
        error: 'insufficient_scope',
        description: `the ${role} role is required`,
      };
    }
    return { ok: true, subject: payload.sub };
  };
}

/** The WWW-Authenticate header for a refusal (RFC 6750 section 3). */
export function challenge(result: Extract<AuthResult, { ok: false }>): string {
  const parts = ['Bearer realm="order-service"'];
  if (result.error) parts.push(`error="${result.error}"`, `error_description="${result.description}"`);
  return parts.join(', ');
}
