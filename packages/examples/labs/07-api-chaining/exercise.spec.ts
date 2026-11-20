import { expect, test } from '@playwright/test';

// Lab 07: read README.md first. This spec has one planted mistake.

const API = 'https://restful-booker.herokuapp.com';

test('a new booking reads back with its guest name', async ({ request }) => {
  const firstname = `Lab07-${Date.now()}`;
  const created = await request.post(`${API}/booking`, {
    headers: { Accept: 'application/json' },
    data: {
      firstname,
      lastname: 'Tester',
      totalprice: 120,
      depositpaid: true,
      bookingdates: { checkin: '2027-01-10', checkout: '2027-01-12' },
    },
  });
  expect(created.ok()).toBe(true);

  // The id this booking got when the test was written.
  const read = await request.get(`${API}/booking/1`, { headers: { Accept: 'application/json' } });
  expect(read.ok()).toBe(true);
  expect((await read.json()).firstname).toBe(firstname);
});
