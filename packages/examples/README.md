# Break-it labs

Eight small, broken tests. Each lab folder has a `README.md` (the symptom, your task, hints),
an `exercise.spec.ts` with one planted mistake, and a `solution.spec.ts` that CI keeps green.

```bash
pnpm lab               # list the labs
pnpm lab 03            # run the exercise: watch it fail, read the error, fix it
pnpm lab 03 --solution # run the reference solution
pnpm test:labs         # run every solution (what CI does)
```

| Lab                                           | Mistake                                            | Site              | Guide                                                                |
| --------------------------------------------- | -------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| [01-hard-wait](labs/01-hard-wait)             | A fixed sleep instead of a web-first assertion     | UI Playground     | [Playwright features](../../docs/learning/02-playwright-features.md) |
| [02-brittle-locator](labs/02-brittle-locator) | A generated id as a locator                        | UI Playground     | [Locators](../../docs/learning/01-locators.md)                       |
| [03-strict-mode](labs/03-strict-mode)         | `.first()` hiding an ambiguous locator             | SauceDemo         | [Locators](../../docs/learning/01-locators.md)                       |
| [04-missing-await](labs/04-missing-await)     | An assertion that is never awaited                 | SauceDemo         | [Playwright features](../../docs/learning/02-playwright-features.md) |
| [05-shared-state](labs/05-shared-state)       | One test feeding another through a module variable | SauceDemo         | [Framework design](../../docs/learning/03-framework-design.md)       |
| [06-late-route](labs/06-late-route)           | A network mock registered after the request        | Playwright demo   | [Playwright features](../../docs/learning/02-playwright-features.md) |
| [07-api-chaining](labs/07-api-chaining)       | A hard-coded record id                             | Restful-Booker    | [API testing](../../docs/learning/04-api-testing.md)                 |
| [08-jwt-trust](labs/08-jwt-trust)             | A token check that never verifies the signature    | none (local keys) | [Security](../../docs/learning/09-security.md)                       |

Try each exercise before opening its solution. Labs 01 to 07 use public practice sites; lab 08 runs
entirely on your machine.
