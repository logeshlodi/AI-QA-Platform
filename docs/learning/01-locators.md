# Locators

**You will learn:** how Playwright finds elements, which locators survive a changing page, and how to
scope, filter and combine them. Every locator type has its own spec in
`packages/playwright-framework/tests/locators/`, each against a real page.

## The order to reach for them

1. **`getByRole`** with a name: how a user and a screen reader see the page. Survives class, id and
   layout changes. `role.spec.ts`
2. **`getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle`**: the other ways people identify
   things. `label.spec.ts`, `placeholder.spec.ts`, `alt-text.spec.ts`, `title.spec.ts`
3. **`getByText`** for content that is not interactive. `text.spec.ts`
4. **`getByTestId`** when the team adds test ids. The attribute is configurable: this repo uses
   `data-test` for SauceDemo (`playwright.config.ts`) and overrides it to `data-testid` for TodoMVC.
   `test-id.spec.ts`
5. **CSS, then XPath**, last, with the reason written down. `css.spec.ts`, `xpath.spec.ts`

## Specs and what each one teaches

| Spec                         | The point                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `role.spec.ts`               | Role plus accessible name; heading `level`; checkbox `checked` state                                                             |
| `text.spec.ts`               | Whitespace is normalised, `exact` and regex narrow a substring match, a non-breaking space counts as a space                     |
| `dynamic-attributes.spec.ts` | An id regenerated on every load breaks an id locator; role and name survive. Match one class token, never the whole class string |
| `filter.spec.ts`             | `filter({ hasText, hasNotText, has, hasNot })` narrows a list by content or by what an item contains                             |
| `chaining-within.spec.ts`    | Chaining searches inside the previous match; `within()` picks one column across every row                                        |
| `and-or.spec.ts`             | `or()` waits for whichever of two outcomes appears; `and()` needs one element to match both                                      |
| `nth.spec.ts`                | `first`, `last`, `nth`, `count`, `all` on a table                                                                                |
| `visible.spec.ts`            | Eight ways to hide a button, and which ones Playwright counts as hidden                                                          |
| `frames.spec.ts`             | `frameLocator` into nested frames; `contentFrame`; a selector-less frame locator                                                 |
| `shadow-dom.spec.ts`         | CSS and `getBy*` pierce open shadow roots; XPath does not                                                                        |
| `locator-handler.spec.ts`    | `addLocatorHandler` closes a modal that appears at random and blocks a click                                                     |
| `aria-snapshot.spec.ts`      | `toMatchAriaSnapshot` asserts the structure of a whole list at once                                                              |
| `describe.spec.ts`           | `describe()` gives a locator a readable name in traces and errors                                                                |
| `custom-engine.spec.ts`      | `selectors.register` adds your own selector engine                                                                               |
| `legacy-layout.spec.ts`      | `:right-of`, `:below`, `:near` still work; the modern equivalent needs no coordinates                                            |

## Ideas worth being able to explain

- **A locator is a recipe, not an element.** It is resolved again on every action, which is why it
  survives re-renders and why there is no "stale element" in Playwright.
- **Strict mode.** An action on a locator that matches more than one element fails instead of picking
  one. That failure is a gift: it tells you the locator is ambiguous before it clicks the wrong thing.
- **Auto-waiting belongs to actions and web-first assertions**, not to `locator()` itself. Creating a
  locator does nothing; `click()` and `expect(...).toBeVisible()` wait.
- **Accessibility and testability are the same work.** A button with no accessible name is hard to
  test and hard to use. When `getByRole` cannot find something, the page often has a bug.

## Common mistakes

| Mistake                                                          | Why it hurts                                                         | Lab |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- | --- |
| Copying an id or a long CSS path from DevTools                   | Breaks on the next build or the next page load                       | 02  |
| A locator that matches several elements, "fixed" with `.first()` | Hides the ambiguity; clicks whichever renders first                  | 03  |
| `nth(2)` to pick a row                                           | Breaks when the order or the data changes; filter by content instead | 03  |
| XPath on `text()`                                                | Defeated by extra whitespace and nested tags (`text.spec.ts`)        | —   |

## Try it

```bash
npx pnpm test:ui tests/locators                   # all locator specs, Chromium
npx pnpm --filter @aiqa/playwright-framework exec playwright codegen https://www.saucedemo.com
```

Codegen suggests a locator for anything you click. Compare its choice with the order above.
