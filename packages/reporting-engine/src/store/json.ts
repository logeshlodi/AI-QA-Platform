import fs from 'node:fs';
import path from 'node:path';
import type { StoredRun } from '../types';
import type { RunRepository } from './repository';

const safeName = (value: string): string => value.replace(/[^A-Za-z0-9-]/g, '-');

/** One JSON file per run. No driver needed, easy to read, diff and upload as a CI artifact. */
export class JsonRunRepository implements RunRepository {
  readonly kind = 'json';
  private readonly directory: string;

  /** `readOnly` never creates the folder; a missing folder simply has no runs. */
  constructor(directory: string, options: { readOnly?: boolean } = {}) {
    this.directory = path.join(directory, 'runs');
    if (!options.readOnly) fs.mkdirSync(this.directory, { recursive: true });
  }

  saveRun(run: StoredRun): void {
    // The timestamp prefix makes file order equal run order; the id keeps names unique.
    // Both are reduced to characters every file system accepts (Windows rejects ':' among others).
    const stamp = safeName(run.run.startedAt);
    const suffix = `_${safeName(run.run.id)}.json`;
    for (const file of fs.readdirSync(this.directory)) {
      if (file.endsWith(suffix)) fs.rmSync(path.join(this.directory, file));
    }
    const target = path.join(this.directory, `${stamp}${suffix}`);
    fs.writeFileSync(`${target}.tmp`, JSON.stringify(run));
    fs.renameSync(`${target}.tmp`, target); // rename is atomic: a reader never sees half a file
  }

  listRuns(limit = 50): StoredRun[] {
    if (!fs.existsSync(this.directory)) return [];
    return fs
      .readdirSync(this.directory)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .slice(-limit)
      .flatMap((file) => {
        try {
          return [JSON.parse(fs.readFileSync(path.join(this.directory, file), 'utf8')) as StoredRun];
        } catch {
          return []; // a damaged file must not take the whole history down
        }
      });
  }

  close(): void {}
}
