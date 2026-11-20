# API testing

**You will learn:** REST with request chaining and token auth, GraphQL, SOAP, schema validation, and how
to keep API tests independent of shared, changing data. Code in `packages/api-framework/`.

## The pieces

| File                              | What it does                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/fixtures.ts`                 | `bookings` (anonymous), `adminBookings` (already authenticated), `countries` (GraphQL), `calculator` (SOAP), all on Playwright's `request` context |
| `src/clients/booking.client.ts`   | One method per endpoint; specs never build URLs or headers                                                                                         |
| `src/builders/booking.builder.ts` | Valid data by default, one field overridden per test                                                                                               |
| `src/schemas/booking.schema.ts`   | zod schemas: the runtime check and the TypeScript type from one definition                                                                         |
| `src/schemas/expect-schema.ts`    | `expectSchema(schema, body)`: one failure listing every wrong field                                                                                |

## Specs and what each one teaches

| Spec                                    | The point                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `restful-booker/auth.spec.ts`           | A token from credentials; bad credentials refused in the body, not by status code; writes without a token forbidden                                       |
| `restful-booker/booking-crud.spec.ts`   | Create, read, update, patch, delete one booking, each step using the id the last returned (chaining); filtering; data-driven cases; 404 for an unknown id |
| `restful-booker/generated-data.spec.ts` | A booking generated from the schema (optionally by a local model) is accepted and reads back unchanged                                                    |
| `graphql/countries.spec.ts`             | Variables; an unknown code is data (`null`), not an error; an invalid query is reported in `errors` with HTTP 200                                         |
| `soap/calculator.spec.ts`               | Building an envelope, parsing the XML answer, escaping special characters                                                                                 |

## Ideas worth being able to explain

- **A test owns its data.** Restful-Booker is public and resets to ten records every ten minutes, so
  every spec creates the booking it needs and never assumes an id exists (lab 07).
- **Status codes lie in both directions.** Restful-Booker reports bad credentials with a 200 and a
  reason in the body; GraphQL reports a broken query with a 200 and an `errors` array. Assert on the
  body, not just the status.
- **Validate the shape, not just a field.** `expectSchema` checks the whole response, so a renamed or
  missing field fails the test even when the field you were asserting on is still there.
- **Clients and builders are why the specs read like requirements.** A spec says "create a booking for
  two nights", not "POST this JSON to that URL".

## Where API testing goes further in this repo

The order service (guide 06) adds an API we control, with an OpenAPI document checked on every response
(guide 08) and OAuth 2.0 tokens from Keycloak (guide 09).

## Try it

```bash
npx pnpm test:api
npx pnpm aiqa data order --count 2 --seed 7      # seeded test data; the same seed gives the same data
```
