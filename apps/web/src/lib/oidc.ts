import * as client from 'openid-client';
import { config } from './config';

let configuration: Promise<client.Configuration> | undefined;

/** Keycloak's metadata, discovered once per server process. A failed discovery is retried next time. */
export function oidc(): Promise<client.Configuration> {
  configuration ??= client
    .discovery(new URL(config.auth.issuer), config.auth.clientId, config.auth.clientSecret, undefined, {
      // The local Keycloak serves plain HTTP; anything else must be HTTPS.
      execute: new URL(config.auth.issuer).protocol === 'http:' ? [client.allowInsecureRequests] : [],
    })
    .catch((error: unknown) => {
      configuration = undefined;
      throw error;
    });
  return configuration;
}

export const redirectUri = () => `${config.appUrl}/auth/callback`;
export const signedOutUrl = () => `${config.appUrl}/signed-out`;
