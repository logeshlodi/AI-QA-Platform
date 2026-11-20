import { test } from '@playwright/test';
import { registerCases } from './cases';
import { verify } from './verifier';

// Lab 08: read README.md first. Fix verifier.ts, not this file.

test.describe('bearer-token verifier', () => {
  registerCases(verify);
});
