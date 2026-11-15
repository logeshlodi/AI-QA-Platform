import type { APIRequestContext, APIResponse } from '@playwright/test';
import { resolveTarget } from '@aiqa/shared';
import type { Booking } from '../schemas/booking.schema';

/** Public demo credentials from the Restful-Booker documentation. Not secrets. */
export const BOOKER_ADMIN = { username: 'admin', password: 'password123' };

/**
 * Thin, typed client for Restful-Booker.
 * It returns the raw APIResponse so specs can assert status, headers and body.
 * It never asserts and never throws on a 4xx: negative tests need those responses.
 */
export class BookingClient {
  private readonly baseUrl = resolveTarget('restfulBooker').baseUrl;
  private token?: string;

  constructor(private readonly request: APIRequestContext) {}

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private get authHeaders(): Record<string, string> {
    return this.token ? { Cookie: `token=${this.token}` } : {};
  }

  ping(): Promise<APIResponse> {
    return this.request.get(this.url('/ping'));
  }

  createToken(credentials = BOOKER_ADMIN): Promise<APIResponse> {
    return this.request.post(this.url('/auth'), { data: credentials });
  }

  /** Log in and remember the token for the write calls below. */
  async authenticate(credentials = BOOKER_ADMIN): Promise<string> {
    const body = (await (await this.createToken(credentials)).json()) as { token?: string };
    if (!body.token) throw new Error('Restful-Booker did not return a token');
    this.token = body.token;
    return body.token;
  }

  list(filter: Partial<Pick<Booking, 'firstname' | 'lastname'>> = {}): Promise<APIResponse> {
    return this.request.get(this.url('/booking'), { params: filter });
  }

  get(id: number): Promise<APIResponse> {
    return this.request.get(this.url(`/booking/${id}`));
  }

  create(booking: Booking): Promise<APIResponse> {
    return this.request.post(this.url('/booking'), { data: booking });
  }

  update(id: number, booking: Booking): Promise<APIResponse> {
    return this.request.put(this.url(`/booking/${id}`), { data: booking, headers: this.authHeaders });
  }

  patch(id: number, changes: Partial<Booking>): Promise<APIResponse> {
    return this.request.patch(this.url(`/booking/${id}`), { data: changes, headers: this.authHeaders });
  }

  delete(id: number): Promise<APIResponse> {
    return this.request.delete(this.url(`/booking/${id}`), { headers: this.authHeaders });
  }
}
