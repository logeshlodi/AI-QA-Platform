# Lab 04: the assertion nobody waited for

**Guide:** [Playwright features](../../../../docs/learning/02-playwright-features.md), "Common mistakes".

## Symptom

SauceDemo's `locked_out_user` is refused at the login page with an error. `exercise.spec.ts` claims the
opposite, that this user reaches the products page, so it fails. But read the error closely:

```text
Error: expect(page).toHaveURL(expected) failed
Expected pattern: /inventory\.html/
Error: Test ended.
```

The test failed in under a second, although `toHaveURL` waits up to 5 seconds. "Test ended" means the
assertion never finished deciding: the test function returned while it was still running, and
Playwright reported that rather than a real verdict. Recent Playwright versions catch this case. Older
ones, and an unawaited assertion inside a helper or a `Promise` chain, can let the test pass.

```bash
pnpm lab 04
```

## Your task

1. Find the line that makes the error say "Test ended" instead of a real failure.
2. Fix it, and see the error change into a real verdict: the URL stayed on the login page for 5 seconds.
3. Then correct the claim: assert what really happens to a locked-out user (the error text and the URL).

## Hints

1. What does `expect(page).toHaveURL(...)` return?
2. What happens to a promise nobody waits for when the test function returns?
3. ESLint's `playwright/missing-playwright-await` catches this before you run anything. It is on for
   every spec in this repository except the lab exercises, which are wrong on purpose.

## What you should come away with

Web-first assertions are asynchronous: without `await` the test moves on, and may end, before the
assertion has decided anything. Do not rely on the runner to notice. Let the linter catch it, and make
every new test fail once, for the reason you expect, before you trust it.
