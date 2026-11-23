import { expect, test } from '@playwright/test';

// Restful-Booker, a public practice API. Read-only here: these smoke tests create nothing.

test('the API is up @smoke', async ({ request }) => {
  const response = await request.get('/ping');
  expect(response.status()).toBe(201);
});

test('bookings are listed by id @smoke', async ({ request }) => {
  const response = await request.get('/booking');
  expect(response.ok()).toBe(true);
  const ids = (await response.json()) as { bookingid: number }[];
  expect(ids.length).toBeGreaterThan(0);
  expect(ids[0]).toEqual({ bookingid: expect.any(Number) });
});

test('one booking has the documented shape', async ({ request }) => {
  const [first] = (await (await request.get('/booking')).json()) as { bookingid: number }[];
  const response = await request.get(`/booking/${first!.bookingid}`, {
    headers: { Accept: 'application/json' },
  });
  // Other people use this API too: a booking can disappear between the two calls.
  test.skip(response.status() === 404, 'the booking was deleted meanwhile');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual(
    expect.objectContaining({
      firstname: expect.any(String),
      lastname: expect.any(String),
      totalprice: expect.any(Number),
      depositpaid: expect.any(Boolean),
      bookingdates: { checkin: expect.any(String), checkout: expect.any(String) },
    }),
  );
});
