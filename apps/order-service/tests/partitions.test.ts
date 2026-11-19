import { describe, expect, it } from 'vitest';
import { PartitionWorkers } from '../src/partitions';

interface Msg {
  partition: number;
  id: string;
}

/** A promise the test resolves by hand, so it controls when each message finishes. */
function gate() {
  let open!: () => void;
  const done = new Promise<void>((resolve) => (open = resolve));
  return { done, open };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('PartitionWorkers', () => {
  it('handles messages of one partition one at a time, in order', async () => {
    const log: string[] = [];
    const gates = new Map(['a', 'b', 'c'].map((id) => [id, gate()]));
    const workers = new PartitionWorkers<Msg>(async (m) => {
      log.push(`start ${m.id}`);
      await gates.get(m.id)!.done;
      log.push(`end ${m.id}`);
    });
    for (const id of ['a', 'b', 'c']) await workers.push({ partition: 0, id });
    await tick();
    expect(log).toEqual(['start a']); // b waits for a, even though it was pushed
    gates.get('b')!.open(); // finishing b early changes nothing: it has not started
    gates.get('a')!.open();
    await tick();
    gates.get('c')!.open();
    await workers.drain();
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('runs different partitions at the same time', async () => {
    const running = new Set<number>();
    let most = 0;
    const g = gate();
    const workers = new PartitionWorkers<Msg>(async (m) => {
      running.add(m.partition);
      most = Math.max(most, running.size);
      await g.done;
      running.delete(m.partition);
    });
    for (const partition of [0, 1, 2]) await workers.push({ partition, id: String(partition) });
    await tick();
    expect(most).toBe(3);
    g.open();
    await workers.drain();
  });

  it('with one queue for everything, runs one message at a time (the old behaviour)', async () => {
    let running = 0;
    let most = 0;
    const workers = new PartitionWorkers<Msg>(
      async () => {
        most = Math.max(most, ++running);
        await tick();
        running--;
      },
      { queueOf: () => 0 },
    );
    for (const partition of [0, 1, 2, 0, 1, 2]) await workers.push({ partition, id: '' });
    await workers.drain();
    expect(most).toBe(1);
  });

  it('push waits once a partition has too many messages queued (backpressure)', async () => {
    const g = gate();
    const workers = new PartitionWorkers<Msg>(() => g.done, { maxQueuedPerPartition: 3 });
    await workers.push({ partition: 0, id: '1' });
    await workers.push({ partition: 0, id: '2' });
    let third = false;
    const pushing = workers.push({ partition: 0, id: '3' }).then(() => (third = true));
    await tick();
    expect(third).toBe(false);
    expect(workers.depth()).toEqual({ 0: 3 });
    g.open();
    await pushing;
    expect(third).toBe(true);
    await workers.drain();
    expect(workers.depth()).toEqual({ 0: 0 });
  });

  it('a failure stops its partition, reports once, and leaves other partitions running', async () => {
    const handled: string[] = [];
    const errors: string[] = [];
    const workers = new PartitionWorkers<Msg>(
      async (m) => {
        if (m.id === 'bad') throw new Error('database down');
        handled.push(m.id);
      },
      { onError: (error, m) => errors.push(`${m.id}: ${(error as Error).message}`) },
    );
    for (const m of [
      { partition: 0, id: 'a' },
      { partition: 0, id: 'bad' },
      { partition: 0, id: 'after-bad' },
      { partition: 1, id: 'other' },
    ])
      await workers.push(m);
    await workers.drain();
    expect(handled).toEqual(['a', 'other']);
    expect(errors).toEqual(['bad: database down']);
  });
});
