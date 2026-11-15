import path from 'node:path';
import { JsonHealRepository } from './json';
import type { HealRepository } from './repository';
import { SqliteHealRepository } from './sqlite';

export type StoreKind = 'auto' | 'sqlite' | 'json';

/**
 * Factory: SQLite when this Node version ships it unflagged, JSON files otherwise.
 * Callers get a HealRepository either way and never need to know which.
 */
export function createHealRepository(directory: string, kind: StoreKind = 'auto'): HealRepository {
  if (kind === 'json') return new JsonHealRepository(directory);
  try {
    return new SqliteHealRepository(path.join(directory, 'history.db'));
  } catch (error) {
    if (kind === 'sqlite') throw error;
    return new JsonHealRepository(directory);
  }
}
