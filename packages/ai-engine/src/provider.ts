export interface CompletionRequest {
  system: string;
  prompt: string;
  /** Ask the model for a JSON object only. */
  json?: boolean;
  timeoutMs?: number;
}

/**
 * The only contract the rest of the platform knows about a language model.
 * WHY an interface: specs and engines never name a vendor, so swapping
 * Ollama for any other endpoint is a one-file change (Adapter pattern).
 */
export interface LlmProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  complete(request: CompletionRequest): Promise<string>;
}
