# {{name}}

Playwright tests started from AI-QA-Platform's `{{kind}}` template ({{date}}).

```bash
npm install
npx playwright install chromium   # once per Playwright version
npm test                          # everything
npm run test:smoke                # the @smoke tests only
npm run report                    # the HTML report of the last run
```

{{suites}}

## Conventions carried over from AI-QA-Platform

- Locators by role, label or test id; CSS only when nothing else names the element.
- Page objects hold locators and steps; specs hold assertions. Fixtures hand page objects to specs.
- No fixed waits: Playwright's assertions retry until they pass or time out.
- Every test is independent: it signs in or creates data for itself.
