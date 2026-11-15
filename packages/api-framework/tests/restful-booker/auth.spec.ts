import { expect, test } from '../../src/fixtures';
import { tokenSchema } from '../../src/schemas/booking.schema';
import { expectSchema } from '../../src/schemas/expect-schema';

test.describe('Restful-Booker: health and auth', () => {
  test('the service answers its health check', async ({ bookings }) => {
    expect((await bookings.ping()).status()).toBe(201);
  });

  test('valid credentials return a token', async ({ bookings }) => {
    const response = await bookings.createToken();
    expect(response.status()).toBe(200);
    expectSchema(tokenSchema, await response.json());
  });

  test('bad credentials are rejected in the body, not by status code', async ({ bookings }) => {
    const response = await bookings.createToken({ username: 'admin', password: 'wrong' });
    // A quirk worth knowing: this API answers 200 with a reason instead of 401.
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ reason: 'Bad credentials' });
  });

  test('writes without a token are forbidden', async ({ bookings }) => {
    expect((await bookings.delete(1)).status()).toBe(403);
  });
});
