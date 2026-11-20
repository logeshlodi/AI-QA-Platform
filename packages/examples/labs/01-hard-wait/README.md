# Lab 01: the sleep that is never long enough

**Guide:** [Playwright features](../../../../docs/learning/02-playwright-features.md), "Waiting and assertions".

## Symptom

`exercise.spec.ts` clicks a button on UI Testing Playground's "Client Side Delay" page and checks the
message the page calculates. It fails with a timeout. A colleague changed the wait from 3 seconds to 20
and it passed, mostly; on a busy CI machine it still fails now and then, and every run now takes 20
seconds even when the page answers in 10.

## Your task

Make the test pass reliably, without any fixed wait, and only as slowly as the page actually is.

```bash
pnpm lab 01
```

## Hints

1. What does `page.waitForTimeout` wait for? What does `locator.textContent()` wait for?
2. Which kind of assertion keeps retrying until the condition holds?
3. The page can take up to about 15 seconds. How does a test say "this one is slow" without slowing
   everything else down?

## What you should come away with

A fixed wait is a guess about the future. A web-first assertion waits for the thing you care about,
for as long as it takes and no longer. `playwright/no-wait-for-timeout` is an error everywhere else in
this repository for that reason.
