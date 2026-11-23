import type { BrowserContext, Request } from '@playwright/test';

export interface NetworkEntry {
  method: string;
  url: string;
  resourceType: string;
  /** HTTP status, or 0 when the request failed before a response. */
  status: number;
  /** From the start of the request to the end of the response, when the browser reports it. */
  durationMs?: number;
  failure?: string;
  slow: boolean;
}

/**
 * Every request a test's pages make, with status and duration. Kept in memory and attached to the
 * report only when the test fails (`networkLog` fixture), so a failure shows what the page asked for
 * and what came back, without opening the trace. Requests slower than `slowMs` are flagged.
 */
export class NetworkLog {
  readonly entries: NetworkEntry[] = [];

  constructor(
    context: BrowserContext,
    private readonly slowMs: number,
  ) {
    context.on('requestfinished', (request) => void this.finished(request));
    context.on('requestfailed', (request) =>
      this.entries.push({
        ...this.base(request),
        status: 0,
        failure: request.failure()?.errorText,
        slow: false,
      }),
    );
  }

  private base(request: Request) {
    return { method: request.method(), url: request.url(), resourceType: request.resourceType() };
  }

  private async finished(request: Request): Promise<void> {
    const response = await request.response().catch(() => null);
    const end = request.timing().responseEnd;
    const durationMs = end >= 0 ? Math.round(end) : undefined;
    this.entries.push({
      ...this.base(request),
      status: response?.status() ?? 0,
      durationMs,
      slow: durationMs !== undefined && durationMs > this.slowMs,
    });
  }

  get slow(): NetworkEntry[] {
    return this.entries.filter((e) => e.slow);
  }

  /** Requests answered 4xx or 5xx, or that failed outright. */
  get errors(): NetworkEntry[] {
    return this.entries.filter((e) => e.status === 0 || e.status >= 400);
  }
}
