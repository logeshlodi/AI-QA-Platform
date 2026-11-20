# Lab 05: the test that only passes after another one

**Guide:** [Framework design](../../../../docs/learning/03-framework-design.md), "Isolation".

## Symptom

The second test in `exercise.spec.ts` uses the product name the first test read. It passed for months
when the suite ran one file at a time, in order. Since the team turned on parallel tests it fails, and
it always fails when run on its own:

```bash
pnpm lab 05
pnpm lab 05 --grep "adds that product"     # just the second test
```

## Your task

Make each test pass on its own, in any order, in any worker, without merging them into one test.

## Hints

1. Each worker is a separate process that loads the spec file for itself. Where does the module-level
   `let` live?
2. If both tests need the same product name, where should it come from?
3. If both tests need the same set-up, which Playwright feature gives each test its own copy?

## What you should come away with

A test must not depend on another test's leftovers: not a variable, not a record in a database, not a
logged-in browser. Give each test what it needs with a fixture, a `beforeEach`, or data of its own.
`pnpm test:shuffle` runs the whole suite in a random order to prove nobody broke this.
