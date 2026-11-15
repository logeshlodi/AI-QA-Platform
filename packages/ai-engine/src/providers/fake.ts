import type { CompletionRequest, LlmProvider } from '../provider';

/** Scripted provider for unit tests: no network, fully deterministic. */
export class FakeProvider implements LlmProvider {
  readonly name = 'fake';
  readonly calls: CompletionRequest[] = [];
  private index = 0;

  constructor(
    private readonly responses: string[] | ((request: CompletionRequest) => string),
    private readonly available = true,
  ) {}

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async complete(request: CompletionRequest): Promise<string> {
    this.calls.push(request);
    if (typeof this.responses === 'function') return this.responses(request);
    const next = this.responses[this.index++];
    if (next === undefined) throw new Error('FakeProvider ran out of scripted responses');
    return next;
  }
}

/** Used when AI is switched off: callers fall back to rules. */
export class NullProvider implements LlmProvider {
  readonly name = 'none';
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async complete(): Promise<string> {
    throw new Error('AI is disabled (AI_ENABLED=false)');
  }
}
