import * as client from 'openid-client';
import { config } from './config';

let configuration: Promise<client.Configuration> | undefined;

/**
 * Server-to-Keycloak calls (discovery, token, keys) go to the internal address when one is set; the
 * browser still goes to the public one. Same paths, only the origin changes.
 */
export function internalFetch(publicIssuer: string, internalIssuer: string): client.CustomFetch {
  const from = new URL(publicIssuer).origin;
  const to = new URL(internalIssuer).origin;
  // The options are the ones openid-client built for fetch; only the type of the body differs.
  return (url, options) =>
    fetch(url.startsWith(from) ? to + url.slice(from.length) : url, options as RequestInit);
}

/** Keycloak's metadata, discovered once per server process. A failed discovery is retried next time. */
export function oidc(): Promise<client.Configuration> {
  configuration ??= client
    .discovery(new URL(config.auth.issuer), config.auth.clientId, config.auth.clientSecret, undefined, {
      // The local Keycloak serves plain HTTP; anything else must be HTTPS.
      execute: new URL(config.auth.issuer).protocol === 'http:' ? [client.allowInsecureRequests] : [],
      ...(config.auth.internalIssuer
        ? { [client.customFetch]: internalFetch(config.auth.issuer, config.auth.internalIssuer) }
        : {}),
    })
    .catch((error: unknown) => {
      configuration = undefined;
      throw error;
    });
  return configuration;
}

export const redirectUri = () => `${config.appUrl}/auth/callback`;
export const signedOutUrl = () => `${config.appUrl}/signed-out`;
