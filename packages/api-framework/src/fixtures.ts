import { test as base } from '@playwright/test';
import { resolveTarget } from '@aiqa/shared';
import { BookingClient } from './clients/booking.client';
import { GraphQlClient } from './clients/graphql.client';
import { SoapClient } from './clients/soap.client';

interface ApiFixtures {
  bookings: BookingClient;
  /** A BookingClient that is already authenticated for update and delete calls. */
  adminBookings: BookingClient;
  countries: GraphQlClient;
  calculator: SoapClient;
}

export const test = base.extend<ApiFixtures>({
  bookings: async ({ request }, use) => use(new BookingClient(request)),
  adminBookings: async ({ request }, use) => {
    const client = new BookingClient(request);
    await client.authenticate();
    await use(client);
  },
  countries: async ({ request }, use) => use(new GraphQlClient(request, resolveTarget('countries').baseUrl)),
  calculator: async ({ request }, use) =>
    use(
      new SoapClient(
        request,
        `${resolveTarget('soapCalculator').baseUrl}/calculator.asmx`,
        'http://tempuri.org/',
      ),
    ),
});
export { expect } from '@playwright/test';
