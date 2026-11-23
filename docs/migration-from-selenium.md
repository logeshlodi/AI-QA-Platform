# Moving from Selenium (Java) to Playwright (TypeScript)

For a team with a Selenium WebDriver suite in Java (TestNG, JUnit or Spock, Maven or Gradle) that wants
to move to Playwright. It maps each Selenium idea to what this repository does instead, then gives a
migration plan that keeps both suites running until the new one has earned trust.

## What changes in the way you think

1. **No explicit waits.** Playwright actions wait for the element to be attached, visible, stable,
   enabled and not covered before acting, and assertions retry until they pass or time out.
   `WebDriverWait`, `ExpectedConditions` and `Thread.sleep` have no replacement because they are not
   needed. A test that still needs a wait is waiting for something you can name: a response, a URL,
   a state.
2. **Locators are lazy.** A `Locator` is a recipe, resolved every time it is used, so there is no
   `StaleElementReferenceException`. A `WebElement` was a handle to one node at one moment.
3. **Isolation is cheap.** A new browser context is a fresh profile in milliseconds. Each test gets
   its own; signing in once and reusing the saved `storageState` replaces logging in per test.
4. **The browser is not a remote black box.** Playwright speaks to the browser directly (CDP and its
   own protocols), so it can intercept the network, emulate devices and time, and record a trace of
   every step, without a proxy or a grid.
5. **Async code.** Every browser call returns a promise; forgetting `await` is the most common
   mistake, and the `playwright/missing-playwright-await` lint rule in this repository catches it for
   assertions and actions.

## Concept map

| Selenium / Java                         | Playwright / this repository                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `WebDriver driver = new ChromeDriver()` | the `page` fixture; browsers come from `projects` in `playwright.config.ts`                                |
| Selenium Grid, Selenoid                 | `--workers` and `--shard` on one machine or CI; a shared browser server in Kubernetes (`PW_WS_ENDPOINT`)   |
| `driver.get(url)`                       | `await page.goto('/inventory.html')` with `baseURL` in the config                                          |
| `By.id`, `By.cssSelector`, `By.xpath`   | `getByRole`, `getByLabel`, `getByTestId`; CSS last; XPath not at all                                       |
| `@FindBy` and `PageFactory`             | locators as readonly fields of a page object (`src/pages`)                                                 |
| `findElements(...).size()`              | `await expect(locator).toHaveCount(n)`                                                                     |
| `WebDriverWait` + `ExpectedConditions`  | web-first assertions (`toBeVisible`, `toHaveText`) and auto-waiting actions                                |
| `Thread.sleep(2000)`                    | nothing; lint rejects `waitForTimeout`                                                                     |
| `Actions` (hover, drag, keys)           | `locator.hover()`, `locator.dragTo()`, `page.keyboard`, `page.mouse`                                       |
| `Select`                                | `locator.selectOption('value')`                                                                            |
| `switchTo().frame()`                    | `page.frameLocator('#id')` (no switching back)                                                             |
| `switchTo().window()`                   | `const popup = await page.waitForEvent('popup')`                                                           |
| `switchTo().alert().accept()`           | `page.once('dialog', (d) => d.accept())` before the action                                                 |
| `JavascriptExecutor`                    | `page.evaluate(...)`, used sparingly                                                                       |
| `TakesScreenshot`                       | `page.screenshot()`, and screenshots, videos and traces on failure from the config                         |
| Cookies to skip login                   | `storageState` saved by a `setup` project                                                                  |
| BrowserMob / proxy to stub calls        | `page.route()` and `routeFromHAR()`                                                                        |
| REST Assured                            | the `request` fixture (`APIRequestContext`), or `packages/api-framework`                                   |
| TestNG `@BeforeMethod` / `@AfterMethod` | fixtures (`test.extend`), set-up and teardown in one place                                                 |
| TestNG `@BeforeSuite`                   | a `setup` project the others depend on, with a `teardown` project                                          |
| `@DataProvider`, Spock `where:`         | a loop over typed data (`for (const row of rows) test(...)`), CSV or YAML through `@aiqa/test-data-engine` |
| TestNG `groups`                         | tags: `test('...', { tag: '@smoke' })` and `--grep @smoke`                                                 |
| `invocationCount`, retry analyser       | `--repeat-each`, `retries` in the config; a retried pass is reported as flaky                              |
| `parallel="methods"` in testng.xml      | `fullyParallel: true` and `workers`                                                                        |
| `SoftAssert`                            | `expect.soft(...)`                                                                                         |
| Spock `given / when / then`             | `test.step('given ...')` blocks; the step names appear in the report                                       |
| Extent / Allure reports                 | the HTML report with traces, plus Allure and our own dashboard                                             |
| Maven / Gradle profiles                 | `projects` and environment variables validated with zod                                                    |
| `testng.xml` suites                     | `projects`, `testMatch` and tags in `playwright.config.ts`                                                 |

## Side by side

Selenium with TestNG:

```java
@Test
public void lockedOutUserIsRefused() {
    driver.get(BASE_URL);
    driver.findElement(By.id("user-name")).sendKeys("locked_out_user");
    driver.findElement(By.id("password")).sendKeys(PASSWORD);
    driver.findElement(By.id("login-button")).click();
    WebElement error = new WebDriverWait(driver, Duration.ofSeconds(10))
        .until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-test='error']")));
    Assert.assertTrue(error.getText().contains("locked out"));
}
```

Playwright in this repository:

```ts
test('a locked-out user is refused with a reason', async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.login(sauceUsers.lockedOut, SAUCE_PASSWORD);
  await expect(loginPage.error).toContainText('locked out');
});
```

The wait, the driver and the explicit `findElement` calls are gone; the page object holds the
locators, and the assertion waits by itself.

## Migration plan

1. **Pick the journeys that matter**, not the whole suite: sign-in, the main purchase or payment
   flow, the reports people look at. Ten good journeys beat three hundred ported tests.
2. **Build the base first**: config, projects per browser, fixtures for the page objects, a
   `setup` project that signs in once, test data per test. That is what this repository's
   `packages/playwright-framework` is.
3. **Rewrite, don't translate.** Port the intent of each test, not its steps. Drop waits, drop
   `findElements` loops, replace XPath with roles and labels. Codegen (`playwright codegen`) and the
   AI test generator here give a first draft to clean up.
4. **Run both suites in CI** side by side for a few weeks. Compare failures: a Playwright failure
   that Selenium did not see is usually a real bug or a missing wait in the old suite.
5. **Retire a Selenium test** only when its Playwright replacement has been green and stable
   (no flaky marks in the history) for the agreed period.
6. **Move the API checks** from REST Assured to the `request` fixture last; they are the least
   brittle part of the old suite and gain the least.

## Things that surprise Java people

- `const` and `readonly` are the defaults; there are no getters for locators.
- No checked exceptions; a failed assertion throws and the test stops (or carries on with `expect.soft`).
- Type safety comes from TypeScript at compile time and zod at run time, for data that comes from
  outside (environment, files, HTTP).
- Tests in one file run in order in one worker unless `fullyParallel` is on; here it is on, so a
  test must never depend on another.
- `npx pnpm` replaces `mvn`; `pnpm-workspace.yaml` (with its version catalog) plays the part of a
  parent POM with `dependencyManagement`.
