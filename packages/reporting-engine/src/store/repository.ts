import type { StoredRun } from '../types';

/** Repository: where run history lives is an implementation detail behind this interface. */
export interface RunRepository {
  readonly kind: string;
  /** Writes one finished run with all its attempts. Saving the same run id again replaces it. */
  saveRun(run: StoredRun): void;
  /** The most recent runs, oldest first. */
  listRuns(limit?: number): StoredRun[];
  close(): void;
}

export class MemoryRunRepository implements RunRepository {
  readonly kind = 'memory';
  private readonly runs = new Map<string, StoredRun>();

  saveRun(run: StoredRun): void {
    this.runs.set(run.run.id, structuredClone(run));
  }
  listRuns(limit = 50): StoredRun[] {
    return [...this.runs.values()]
      .sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt))
      .slice(-limit)
      .map((run) => structuredClone(run));
  }
  close(): void {}
}
