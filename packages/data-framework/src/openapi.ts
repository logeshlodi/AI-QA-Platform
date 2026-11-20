import type { APIResponse } from '@playwright/test';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

/** The parts of an OpenAPI 3.1 document this checker reads. */
export interface OpenApiDocument {
  openapi: string;
  paths: Record<
    string,
    Record<string, { responses: Record<string, { content?: Record<string, { schema: object }> }> }>
  >;
}

export interface ContractResult {
  ok: boolean;
  /** One line per problem, e.g. "200 body /status: must be equal to one of the allowed values". */
  problems: string[];
}

/**
 * Checks real responses against the service's published OpenAPI document: the status code must be one
 * the document lists for that operation, and the body must match that status's schema. It uses the
 * document the running service serves, not the service's source, so it tests what a client would rely on.
 */
export class ContractChecker {
  private readonly ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));
  private readonly compiled = new Map<string, ValidateFunction>();

  constructor(readonly document: OpenApiDocument) {}

  /** `path` is the document's path template, e.g. "/orders/{id}". */
  async check(method: string, path: string, response: APIResponse): Promise<ContractResult> {
    const operation = this.document.paths[path]?.[method.toLowerCase()];
    if (!operation)
      return { ok: false, problems: [`${method.toUpperCase()} ${path} is not in the document`] };
    const status = String(response.status());
    const documented = operation.responses[status];
    if (!documented) {
      const listed = Object.keys(operation.responses).join(', ');
      return { ok: false, problems: [`status ${status} is not documented (documented: ${listed})`] };
    }
    const schema = documented.content?.['application/json']?.schema;
    if (!schema) return { ok: true, problems: [] };

    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.startsWith('application/json')) {
      return { ok: false, problems: [`content-type is "${contentType}", not application/json`] };
    }
    const key = `${method} ${path} ${status}`;
    let validate = this.compiled.get(key);
    if (!validate) {
      validate = this.ajv.compile(schema);
      this.compiled.set(key, validate);
    }
    const body: unknown = await response.json();
    if (validate(body)) return { ok: true, problems: [] };
    return {
      ok: false,
      problems: (validate.errors ?? []).map(
        (e) => `${status} body ${e.instancePath || '/'}: ${e.message ?? 'invalid'}`,
      ),
    };
  }
}
