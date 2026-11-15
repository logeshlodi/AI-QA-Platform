import { createProvider, generateData } from '@aiqa/ai-engine';
import { loadEnv } from '@aiqa/shared';
import { z } from 'zod';
import { BookingBuilder } from '../../src/builders/booking.builder';
import { expect, test } from '../../src/fixtures';
import { bookingSchema, createdBookingSchema } from '../../src/schemas/booking.schema';
import { expectSchema } from '../../src/schemas/expect-schema';

const env = loadEnv();

// Tighter than the response contract: this is what we are willing to SEND.
// The API stores whole-number prices, so a generated 199.99 would not read back equal.
const newBookingSchema = bookingSchema.extend({
  firstname: z.string().min(1).max(40),
  lastname: z.string().min(1).max(40),
  totalprice: z.number().int().min(1).max(5000),
  additionalneeds: z.string().min(1).max(60),
});

/**
 * Schema-driven test data. With AI_ENABLED=true a local model writes a booking that fits the
 * scenario in the hint; the answer is validated against the schema before it is used.
 * With AI off (the default, and in CI) the faker-based builder supplies the record,
 * so this spec passes either way and the annotation says which source was used.
 */
test.describe('Restful-Booker: schema-driven test data', { tag: '@ai' }, () => {
  test('a generated booking is accepted and reads back unchanged', async ({ bookings }) => {
    if (env.AI_ENABLED) test.setTimeout(env.OLLAMA_TIMEOUT_MS * 2 + 30_000);

    const { data, source } = await generateData(createProvider(env), newBookingSchema, {
      hint: 'a family booking one week at a beach hotel next month; dates as YYYY-MM-DD, checkout after checkin',
      fallback: () => new BookingBuilder().build() as z.infer<typeof newBookingSchema>,
    });
    test.info().annotations.push({ type: 'test-data-source', description: source });

    const response = await bookings.create(data);
    expect(response.status()).toBe(200);
    expect(expectSchema(createdBookingSchema, await response.json()).booking).toEqual(data);
  });
});
