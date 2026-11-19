import { Faker, en } from '@faker-js/faker';

/**
 * Dates are generated relative to this fixed moment, not "now": otherwise a "recent" date
 * shifts with the clock and the same seed stops giving the same record.
 */
export const REFERENCE_DATE = new Date('2026-01-01T00:00:00.000Z');

/**
 * A faker instance with its own seed. Same seed, same data, on every machine and every run,
 * so a failure can be replayed exactly. Each builder owns one: two builders never share a sequence.
 */
export function seededFaker(seed: number): Faker {
  const faker = new Faker({ locale: [en] });
  faker.seed(seed);
  faker.setDefaultRefDate(REFERENCE_DATE);
  return faker;
}

/** Seed from AIQA_SEED when set (to replay a run), otherwise a fresh random one. */
export function defaultSeed(): number {
  const fromEnv = Number(process.env.AIQA_SEED);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : Math.floor(Math.random() * 2 ** 31);
}
