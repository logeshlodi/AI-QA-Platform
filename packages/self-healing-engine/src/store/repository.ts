import type { Fingerprint, HealEvent } from '../types';

/**
 * Repository pattern: the engine and the framework talk to this interface only,
 * so the storage engine (memory, JSON files, SQLite, later PostgreSQL) can
 * change without touching a caller.
 */
export interface HealRepository {
  readonly kind: string;
  getFingerprint(locatorKey: string): Fingerprint | undefined;
  saveFingerprint(fingerprint: Fingerprint): void;
  recordEvent(event: HealEvent): void;
  listEvents(): HealEvent[];
  close(): void;
}

export class MemoryHealRepository implements HealRepository {
  readonly kind = 'memory';
  private readonly fingerprints = new Map<string, Fingerprint>();
  private readonly events: HealEvent[] = [];

  getFingerprint(locatorKey: string): Fingerprint | undefined {
    return this.fingerprints.get(locatorKey);
  }
  saveFingerprint(fingerprint: Fingerprint): void {
    this.fingerprints.set(fingerprint.locatorKey, fingerprint);
  }
  recordEvent(event: HealEvent): void {
    this.events.push(event);
  }
  listEvents(): HealEvent[] {
    return [...this.events];
  }
  close(): void {}
}
