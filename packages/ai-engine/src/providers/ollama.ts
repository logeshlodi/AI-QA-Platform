import type { CompletionRequest, LlmProvider } from '../provider';

export interface OllamaOptions {
  baseUrl: string;
  model: string;
  /** Per-request limit when the caller does not set one. */
  timeoutMs?: number;
  /** Injected in unit tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/** Adapter for a local Ollama server (https://github.com/ollama/ollama, MIT). */
export class OllamaProvider implements LlmProvider {
  readonly name: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OllamaOptions) {
    this.name = `ollama:${options.model}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** True only when the server answers AND the configured model is pulled. */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.options.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as { models?: { name: string }[] };
      const wanted = this.options.model;
      return (body.models ?? []).some((m) => m.name === wanted || m.name.startsWith(`${wanted}:`));
    } catch {
      return false;
    }
  }

  async complete(request: CompletionRequest): Promise<string> {
    const res = await this.fetchImpl(`${this.options.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(request.timeoutMs ?? this.options.timeoutMs ?? 60_000),
      body: JSON.stringify({
        model: this.options.model,
        system: request.system,
        prompt: request.prompt,
        stream: false,
        format: request.json ? 'json' : undefined,
        options: { temperature: 0 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama answered ${res.status} for model ${this.options.model}`);
    const body = (await res.json()) as { response?: string };
    return body.response ?? '';
  }
}
