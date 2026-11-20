# Lab 03: six buttons called "Add to cart"

**Guide:** [Locators](../../../../docs/learning/01-locators.md), "Strict mode" and `filter.spec.ts`.

## Symptom

The test should put the **Sauce Labs Bike Light** in the cart. The first version failed with
"strict mode violation: resolved to 6 elements". A colleague "fixed" it by adding `.first()`. Now the
test runs to the end, and fails on the last line: the cart holds the wrong product.

## Your task

Click the "Add to cart" button that belongs to the Bike Light, whatever position the product is in.

```bash
pnpm lab 03
```

## Hints

1. Every product card has the same button. What is different about the Bike Light's card?
2. `locator.filter({ hasText })` keeps only the matches that contain some text.
3. Once you have the right card, search inside it.

## What you should come away with

Strict mode failing is Playwright telling you the locator is ambiguous. `.first()` and `nth()` silence
it by picking one, often the wrong one, and break again when the order or the data changes. Scope by
content instead. `InventoryPage.card(name)` in the framework does exactly this.
