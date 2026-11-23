{
  "name": "{{name}}",
  "version": "0.1.0",
  "private": true,
  "description": "Playwright tests, started from AI-QA-Platform's {{kind}} template",
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "typecheck": "tsc --noEmit",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "{{playwrightVersion}}",
    "@types/node": "^22.0.0",
    "typescript": "{{typescriptVersion}}"
  }
}
