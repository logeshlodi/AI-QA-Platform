import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Fingerprint, HealEvent } from '../types';
import type { HealRepository } from './repository';
import { SCHEMA } from './schema';

// Minimal shape of node:sqlite that we use. Loaded with require() at run time so
// the package still loads on Node versions where the module is behind a flag.
interface Statement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}
interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** SQLite store using Node's built-in driver: no native build step, one file on disk. */
export class SqliteHealRepository implements HealRepository {
  readonly kind = 'sqlite';
  private readonly db: Database;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const sqlite = createRequire(__filename)('node:sqlite') as {
      DatabaseSync: new (file: string) => Database;
    };
    this.db = new sqlite.DatabaseSync(file);
    // WAL plus a busy timeout lets several Playwright workers write at once.
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);
  }

  getFingerprint(locatorKey: string): Fingerprint | undefined {
    const row = this.db.prepare('SELECT * FROM locator_fingerprint WHERE locator_key = ?').get(locatorKey);
    if (!row) return undefined;
    return {
      locatorKey: text(row.locator_key),
      selector: text(row.selector),
      tag: text(row.tag),
      role: text(row.role),
      accessibleName: text(row.accessible_name),
      text: text(row.text),
      testId: text(row.test_id_attr),
      attributes: JSON.parse(text(row.attributes) || '{}') as Record<string, string>,
      ancestorPath: text(row.ancestor_path),
      cssPath: text(row.css_path),
      context: text(row.context),
      pageUrl: text(row.page_url),
      updatedAt: text(row.updated_at),
    };
  }

  saveFingerprint(f: Fingerprint): void {
    this.db
      .prepare(
        `INSERT INTO locator_fingerprint
           (locator_key, selector, tag, role, accessible_name, text, test_id_attr, attributes, ancestor_path, css_path, context, page_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(locator_key) DO UPDATE SET
           selector = excluded.selector, tag = excluded.tag, role = excluded.role,
           accessible_name = excluded.accessible_name, text = excluded.text, test_id_attr = excluded.test_id_attr,
           attributes = excluded.attributes, ancestor_path = excluded.ancestor_path, css_path = excluded.css_path, context = excluded.context,
           page_url = excluded.page_url, updated_at = excluded.updated_at`,
      )
      .run(
        f.locatorKey,
        f.selector,
        f.tag,
        f.role,
        f.accessibleName,
        f.text,
        f.testId,
        JSON.stringify(f.attributes),
        f.ancestorPath,
        f.cssPath,
        f.context ?? '',
        f.pageUrl,
        f.updatedAt,
      );
  }

  recordEvent(e: HealEvent): void {
    this.db
      .prepare(
        `INSERT INTO heal_event (test_id, locator_key, failed_selector, healed_selector, strategy, score, outcome, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.testId,
        e.locatorKey,
        e.failedSelector,
        e.healedSelector ?? null,
        e.strategy,
        e.score,
        e.outcome,
        e.createdAt,
      );
  }

  listEvents(): HealEvent[] {
    return this.db
      .prepare('SELECT * FROM heal_event ORDER BY id')
      .all()
      .map((row) => ({
        testId: text(row.test_id),
        locatorKey: text(row.locator_key),
        failedSelector: text(row.failed_selector),
        healedSelector: typeof row.healed_selector === 'string' ? row.healed_selector : undefined,
        strategy: text(row.strategy),
        score: Number(row.score),
        outcome: text(row.outcome) as HealEvent['outcome'],
        createdAt: text(row.created_at),
      }));
  }

  close(): void {
    this.db.close();
  }
}
