/**
 * Runs a handler for every message with the partitions in parallel and one message at a time within
 * each partition.
 *
 * Kafka only orders messages within a partition, and the service keys every order event by order id,
 * so everything about one order arrives on one partition, in order. Handling partitions side by side
 * keeps that guarantee and lets the service use the waiting time of one order (database round trips,
 * the reply to Kafka) to work on others. One message at a time across all partitions was the limit
 * the stress test found on 19 Nov 2026: about 35 orders a second.
 */
export class PartitionWorkers<M extends { partition: number }> {
  private readonly tails = new Map<number, Promise<void>>();
  private readonly queued = new Map<number, number>();
  private failed = false;

  constructor(
    private readonly handle: (message: M) => Promise<void>,
    private readonly options: {
      /** Messages a partition may have waiting before reading stops until it catches up. */
      maxQueuedPerPartition?: number;
      /** Called once, with the first error. The partition stops: nothing after the failed message runs. */
      onError?: (error: unknown, message: M) => void;
      /** Which queue a message joins. Default: its partition. A constant puts everything in one queue. */
      queueOf?: (message: M) => number;
    } = {},
  ) {}

  /**
   * Queues a message behind the earlier ones from its partition. Resolves straight away while the
   * partition has room, otherwise once it has caught up: the caller awaits it before reading the next
   * message, which is the backpressure that keeps memory bounded when the service falls behind.
   */
  async push(message: M): Promise<void> {
    const partition = this.options.queueOf ? this.options.queueOf(message) : message.partition;
    const waiting = (this.queued.get(partition) ?? 0) + 1;
    this.queued.set(partition, waiting);
    const previous = this.tails.get(partition) ?? Promise.resolve();
    // A rejected `previous` skips this handler: a partition stops at its first failure, so a later
    // message is never handled (or committed) past one that was not.
    const tail = previous
      .then(() => this.handle(message))
      .catch((error: unknown) => {
        if (!this.failed) {
          this.failed = true;
          this.options.onError?.(error, message);
        }
        throw error;
      })
      .finally(() => this.queued.set(partition, (this.queued.get(partition) ?? 1) - 1));
    tail.catch(() => undefined); // handled through onError; keep Node from reporting it as unhandled
    this.tails.set(partition, tail);
    if (waiting >= (this.options.maxQueuedPerPartition ?? 50)) await tail.catch(() => undefined);
  }

  /** Messages waiting or being handled, per partition. */
  depth(): Record<number, number> {
    return Object.fromEntries(this.queued);
  }

  /** Resolves once every queued message has been handled (or its partition has stopped). */
  async drain(): Promise<void> {
    await Promise.all([...this.tails.values()].map((tail) => tail.catch(() => undefined)));
  }
}
