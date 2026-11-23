# templates

Starter projects for `aiqa new project`: a standalone npm project with Playwright and TypeScript at
the versions this repository runs, following its patterns (locators by role, page objects behind
fixtures, no fixed waits).

| Kind   | What you get                                                                           |
| ------ | -------------------------------------------------------------------------------------- |
| `ui`   | `tests/ui`: SauceDemo sign-in and cart specs, two page objects, fixtures               |
| `api`  | `tests/api`: Restful-Booker read-only smoke checks of status codes and response shapes |
| `both` | Both suites as two Playwright projects (`ui`, `api`)                                   |

```bash
pnpm aiqa new project checkout-tests --kind both --dir ../checkout-tests
cd ../checkout-tests && npm install && npx playwright install chromium && npm test
```

The files live in `files/<layer>`: `base` (package.json, tsconfig, README, .gitignore) plus `ui` and/or
`api`; `playwright.config.ts` is generated for the kind. `{{name}}`-style placeholders are filled only
in `.tpl` files. CI generates each kind and runs its tests, so a template that breaks fails the build.
