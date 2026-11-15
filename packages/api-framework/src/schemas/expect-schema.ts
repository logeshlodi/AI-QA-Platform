import { expect } from '@playwright/test';
import type { z } from 'zod';

/** Assert that a payload matches a schema, with every violation in the failure message. */
export function expectSchema<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  const issues = result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  expect(issues, `response does not match the schema:\n${JSON.stringify(payload, null, 2)}`).toEqual([]);
  return result.data as T;
}
