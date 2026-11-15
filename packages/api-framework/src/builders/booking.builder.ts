import { faker } from '@faker-js/faker';
import type { Booking } from '../schemas/booking.schema';

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Builder: a valid booking by default, with only the interesting field set per test.
 *   new BookingBuilder().withPrice(0).build()
 * WHY over JSON fixture files: fixtures get copied and drift; a builder keeps
 * one definition of "valid" and makes each test say what it actually cares about.
 */
export class BookingBuilder {
  private readonly booking: Booking;

  constructor(seed?: number) {
    if (seed !== undefined) faker.seed(seed); // same seed, same data: reproducible failures
    const checkin = faker.date.soon({ days: 30 });
    const checkout = new Date(checkin.getTime() + faker.number.int({ min: 1, max: 14 }) * 86_400_000);
    this.booking = {
      firstname: faker.person.firstName(),
      lastname: faker.person.lastName(),
      totalprice: faker.number.int({ min: 50, max: 2000 }),
      depositpaid: true,
      bookingdates: { checkin: day(checkin), checkout: day(checkout) },
      additionalneeds: 'Breakfast',
    };
  }

  withGuest(firstname: string, lastname: string): this {
    this.booking.firstname = firstname;
    this.booking.lastname = lastname;
    return this;
  }

  withPrice(totalprice: number): this {
    this.booking.totalprice = totalprice;
    return this;
  }

  withoutDeposit(): this {
    this.booking.depositpaid = false;
    return this;
  }

  build(): Booking {
    return structuredClone(this.booking);
  }
}
