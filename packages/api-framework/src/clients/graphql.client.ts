import type { APIRequestContext } from '@playwright/test';

export interface GraphQlResult<T> {
  status: number;
  data?: T;
  errors?: { message: string }[];
}

/** GraphQL over Playwright's request context, so calls show up in traces like any other request. */
export class GraphQlClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly endpoint: string,
  ) {}

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<GraphQlResult<T>> {
    const response = await this.request.post(this.endpoint, { data: { query, variables } });
    const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
    return { status: response.status(), data: body.data, errors: body.errors };
  }
}
