import type { CryptoKey } from 'jose';

/** What a verifier is given: the token, plus the public key the server trusts. */
export interface VerifyInput {
  token: string;
  trustedKey: CryptoKey;
  audience: string;
  requiredRole: string;
}

/** Resolves with the subject when the token may write; rejects otherwise. */
export type Verify = (input: VerifyInput) => Promise<string>;
