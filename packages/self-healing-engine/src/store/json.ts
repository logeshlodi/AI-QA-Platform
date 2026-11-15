import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Fingerprint, HealEvent } from '../types';
import type { HealRepository } from './repository';

/**
 * File-backed store with no native dependency.
 * One file per fingerprint (written to a temp file, then renamed) and an
 * append-only events log, so parallel Playwright workers never corrupt it.
 */
export class JsonHealRepository implements HealRepository {
  readonly kind = 'json';
  private readonly fingerprintDir: string;
  private readonly eventsFile: string;

  constructor(directory: string) {
    this.fingerprintDir = path.join(directory, 'fingerprints');
    this.eventsFile = path.join(directory, 'heal-events.jsonl');
    fs.mkdirSync(this.fingerprintDir, { recursive: true });
  }

  private fileFor(locatorKey: string): string {
    const hash = createHash('sha1').update(locatorKey).digest('hex').slice(0, 16);
    return path.join(this.fingerprintDir, `${hash}.json`);
  }

  getFingerprint(locatorKey: string): Fingerprint | undefined {
    try {
      return JSON.parse(fs.readFileSync(this.fileFor(locatorKey), 'utf8')) as Fingerprint;
    } catch {
      return undefined;
    }
  }

  saveFingerprint(fingerprint: Fingerprint): void {
    const file = this.fileFor(fingerprint.locatorKey);
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(fingerprint, null, 2));
    fs.renameSync(temp, file);
  }

  recordEvent(event: HealEvent): void {
    fs.appendFileSync(this.eventsFile, `${JSON.stringify(event)}\n`);
  }

  listEvents(): HealEvent[] {
    if (!fs.existsSync(this.eventsFile)) return [];
    return fs
      .readFileSync(this.eventsFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as HealEvent);
  }

  close(): void {}
}
