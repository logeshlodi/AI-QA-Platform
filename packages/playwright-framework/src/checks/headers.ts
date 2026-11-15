/** Response headers a hardened site is expected to send. */
export const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
] as const;

export function missingSecurityHeaders(headers: Record<string, string>): string[] {
  const present = new Set(Object.keys(headers).map((h) => h.toLowerCase()));
  return SECURITY_HEADERS.filter((h) => !present.has(h));
}
