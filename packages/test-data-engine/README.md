# @aiqa/test-data-engine

E-commerce test data that is random, valid and reproducible.

- **Schemas** (`src/schemas.ts`, zod): customer, product, order. Money in whole cents; an order's
  total must equal the sum of its lines.
- **Builders**: `aCustomer()`, `aProduct()`, `anOrder()` with `.with({...})`, `.build()`,
  `.buildMany(n)`. `build()` validates, so a builder can never hand a test invalid data by accident;
  `buildUnchecked()` is the explicit way to make bad data for negative tests.
- **Seeds**: every builder takes a seed. Same seed, same data. Set `AIQA_SEED` to replay a run.
- **Scenarios**: `shop()` builds customers, a catalogue and orders that reference each other.
- **AI**: `generateOr(schema, hint, fallback)` asks the local model for a record when `AI_ENABLED=true`
  and falls back to the builder otherwise.

Used by the Postgres, MongoDB and Kafka suites in `packages/data-framework`, and by `aiqa data`.
