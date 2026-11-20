# Lab 06: the mock that never answers

**Guide:** [Playwright features](../../../../docs/learning/02-playwright-features.md), "Network".

## Symptom

Playwright's API-mocking demo page loads a list of fruit from `/api/v1/fruits` when it opens.
`exercise.spec.ts` mocks that call so the page shows one made-up fruit, Jackfruit. The mock is
registered, the code looks right, and the page still shows the real fruit.

## Your task

Make the page show only the mocked fruit.

```bash
pnpm lab 06
```

## Hints

1. When does the page request the fruit list?
2. When does the exercise register the route?
3. `page.route` only sees requests made after it is registered.

## What you should come away with

Set up network routes, `waitForResponse` promises and event listeners before the action that triggers
the traffic, usually before `goto` or the click. `tests/features/network-mocking.spec.ts` shows
observing, fulfilling, modifying and aborting, each set up first.
