import { z } from 'zod';
import { expect, test } from '../../src/fixtures';
import { expectSchema } from '../../src/schemas/expect-schema';

const countrySchema = z.object({
  country: z.object({
    name: z.string(),
    capital: z.string(),
    currency: z.string(),
    continent: z.object({ name: z.string() }),
  }),
});

const COUNTRY = `query Country($code: ID!) { country(code: $code) { name capital currency continent { name } } }`;

test.describe('GraphQL: countries API', () => {
  test('a query with a variable returns exactly the requested fields', async ({ countries }) => {
    const result = await countries.query(COUNTRY, { code: 'IN' });
    expect(result.status).toBe(200);
    expect(result.errors).toBeUndefined();
    expect(expectSchema(countrySchema, result.data)).toEqual({
      country: { name: 'India', capital: 'New Delhi', currency: 'INR', continent: { name: 'Asia' } },
    });
  });

  test('an unknown code is data, not an error: the field comes back null', async ({ countries }) => {
    const result = await countries.query<{ country: null }>(COUNTRY, { code: 'ZZ' });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ country: null });
  });

  test('an invalid query is reported in the errors array', async ({ countries }) => {
    const result = await countries.query('{ country(code: "IN") { doesNotExist } }');
    expect(result.data).toBeUndefined();
    expect(result.errors?.[0]?.message).toContain('doesNotExist');
  });
});
