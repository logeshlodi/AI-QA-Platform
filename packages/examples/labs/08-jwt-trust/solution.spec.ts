import { test } from '@playwright/test';
import { registerCases } from './cases';
import { verify } from './solution.verifier';

// Lab 08, solved: the same attacks, against a verifier that checks the signature first.

test.describe('bearer-token verifier', () => {
  registerCases(verify);
});
