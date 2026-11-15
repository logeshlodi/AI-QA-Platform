import { BookingBuilder } from '../../src/builders/booking.builder';
import { expect, test } from '../../src/fixtures';
import { bookingIdListSchema, bookingSchema, createdBookingSchema } from '../../src/schemas/booking.schema';
import { expectSchema } from '../../src/schemas/expect-schema';

// This API resets itself every ten minutes, so every test creates the booking it needs
// and never depends on an id that happens to exist.
test.describe('Restful-Booker: booking lifecycle', () => {
  test('create, read, update, patch and delete one booking (request chaining)', async ({ adminBookings }) => {
    const original = new BookingBuilder().withGuest('Logesh', 'Chain').build();

    const id = await test.step('create', async () => {
      const response = await adminBookings.create(original);
      expect(response.status()).toBe(200);
      const created = expectSchema(createdBookingSchema, await response.json());
      expect(created.booking).toEqual(original);
      return created.bookingid;
    });

    await test.step('read back', async () => {
      const response = await adminBookings.get(id);
      expect(response.status()).toBe(200);
      expect(expectSchema(bookingSchema, await response.json())).toEqual(original);
    });

    await test.step('replace with PUT', async () => {
      const replacement = new BookingBuilder().withGuest('Logesh', 'Replaced').withPrice(999).build();
      const response = await adminBookings.update(id, replacement);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual(replacement);
    });

    await test.step('change one field with PATCH', async () => {
      const response = await adminBookings.patch(id, { additionalneeds: 'Late checkout' });
      expect(response.status()).toBe(200);
      expect(expectSchema(bookingSchema, await response.json())).toMatchObject({
        lastname: 'Replaced',
        totalprice: 999,
        additionalneeds: 'Late checkout',
      });
    });

    await test.step('delete, then confirm it is gone', async () => {
      expect((await adminBookings.delete(id)).status()).toBe(201);
      expect((await adminBookings.get(id)).status()).toBe(404);
    });
  });

  test('the booking list can be filtered by guest name', async ({ adminBookings }) => {
    const unique = `Filter${Date.now()}`;
    const created = expectSchema(
      createdBookingSchema,
      await (await adminBookings.create(new BookingBuilder().withGuest('Logesh', unique).build())).json(),
    );

    const response = await adminBookings.list({ lastname: unique });
    expect(expectSchema(bookingIdListSchema, await response.json())).toEqual([
      { bookingid: created.bookingid },
    ]);

    await adminBookings.delete(created.bookingid);
  });

  // Data-driven: each row becomes its own test in the report.
  for (const row of [
    { name: 'a free stay', build: () => new BookingBuilder().withPrice(0).build() },
    { name: 'no deposit', build: () => new BookingBuilder().withoutDeposit().build() },
    {
      name: 'a guest name with an apostrophe',
      build: () => new BookingBuilder().withGuest("D'Arcy", "O'Neil").build(),
    },
  ]) {
    test(`accepts a booking with ${row.name}`, async ({ adminBookings }) => {
      const booking = row.build();
      const created = expectSchema(createdBookingSchema, await (await adminBookings.create(booking)).json());
      expect(created.booking).toEqual(booking);
      await adminBookings.delete(created.bookingid);
    });
  }

  test('an unknown booking id returns 404', async ({ bookings }) => {
    expect((await bookings.get(99_999_999)).status()).toBe(404);
  });
});
