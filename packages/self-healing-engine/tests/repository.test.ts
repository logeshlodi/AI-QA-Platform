import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createHealRepository,
  JsonHealRepository,
  MemoryHealRepository,
  SqliteHealRepository,
  type HealEvent,
  type HealRepository,
} from '../src';
import { fingerprint } from './helpers';

const dirs: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const sqliteAvailable = (() => {
  try {
    new SqliteHealRepository(path.join(tempDir(), 'probe.db')).close();
    return true;
  } catch {
    return false;
  }
})();

const event: HealEvent = {
  locatorKey: 'Page.button',
  testId: 'spec-1',
  failedSelector: "locator('#old')",
  healedSelector: 'body > button',
  suggestion: "page.getByRole('button', { name: 'Pay now' })",
  strategy: 'role',
  score: 0.91,
  outcome: 'healed',
  createdAt: '2026-11-13T00:00:00.000Z',
};

// The same contract runs against every implementation: that is what makes them interchangeable.
const implementations: [string, () => HealRepository, boolean][] = [
  ['memory', () => new MemoryHealRepository(), true],
  ['json', () => new JsonHealRepository(tempDir()), true],
  ['sqlite', () => new SqliteHealRepository(path.join(tempDir(), 'history.db')), sqliteAvailable],
];

describe.each(implementations)('HealRepository contract: %s', (_name, create, enabled) => {
  it.skipIf(!enabled)('returns undefined for an unknown key', () => {
    const repo = create();
    expect(repo.getFingerprint('nope')).toBeUndefined();
    repo.close();
  });

  it.skipIf(!enabled)('round-trips a fingerprint and overwrites on the same key', () => {
    const repo = create();
    const first = fingerprint({ attributes: { class: 'a b' }, text: 'It\'s "quoted"' });
    repo.saveFingerprint(first);
    expect(repo.getFingerprint(first.locatorKey)).toEqual(first);
    repo.saveFingerprint({ ...first, text: 'changed' });
    expect(repo.getFingerprint(first.locatorKey)?.text).toBe('changed');
    repo.close();
  });

  it.skipIf(!enabled)('keeps heal events in order, including refusals without a healed selector', () => {
    const repo = create();
    repo.recordEvent(event);
    const refused = {
      ...event,
      outcome: 'refused' as const,
      healedSelector: undefined,
      suggestion: undefined,
      score: 0.4,
    };
    repo.recordEvent(refused);
    expect(repo.listEvents()).toEqual([event, refused]);
    repo.close();
  });
});

describe('SqliteHealRepository migration', () => {
  it.skipIf(!sqliteAvailable)('adds the suggestion column to a store made before it existed', () => {
    const file = path.join(tempDir(), 'old.db');
    const sqlite = createRequire(__filename)('node:sqlite') as {
      DatabaseSync: new (f: string) => { exec(s: string): void; close(): void };
    };
    const old = new sqlite.DatabaseSync(file);
    old.exec(`CREATE TABLE heal_event (id INTEGER PRIMARY KEY, test_id TEXT NOT NULL, locator_key TEXT NOT NULL,
      failed_selector TEXT NOT NULL, healed_selector TEXT, strategy TEXT NOT NULL, score REAL NOT NULL,
      outcome TEXT NOT NULL, created_at TEXT NOT NULL)`);
    old.exec(`INSERT INTO heal_event (test_id, locator_key, failed_selector, strategy, score, outcome, created_at)
      VALUES ('t', 'Old.key', 'locator(''#x'')', 'role', 0.9, 'healed', '2026-11-01T00:00:00Z')`);
    old.close();

    const repo = new SqliteHealRepository(file);
    repo.recordEvent(event);
    expect(repo.listEvents().map((e) => [e.locatorKey, e.suggestion])).toEqual([
      ['Old.key', undefined],
      ['Page.button', event.suggestion],
    ]);
    repo.close();
  });
});

describe('createHealRepository', () => {
  it('honours an explicit json request', () => {
    expect(createHealRepository(tempDir(), 'json').kind).toBe('json');
  });
  it('picks a working store automatically', () => {
    const repo = createHealRepository(tempDir());
    expect(repo.kind).toBe(sqliteAvailable ? 'sqlite' : 'json');
    repo.close();
  });
});
