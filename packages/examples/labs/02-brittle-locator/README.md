# Lab 02: the id that changes every day

**Guide:** [Locators](../../../../docs/learning/01-locators.md).

## Symptom

`exercise.spec.ts` was recorded by copying the button's id from DevTools. It passed on the day it was
written. Now it fails every run. To show you why, the exercise reads the id on one visit and uses it on
the next, which is what happens between the day a test is written and the day it runs.

## Your task

Find the button in a way that still works on the next visit, and the one after that.

```bash
pnpm lab 02
```

## Hints

1. Open http://www.uitestingplayground.com/dynamicid twice and compare the button's `id`.
2. What does a person use to find this button? What does a screen reader announce?
3. Which locator in the guide's "order to reach for them" uses exactly that?

## What you should come away with

Generated ids, long CSS paths and positions describe how the page is built today. Role and accessible
name describe what the element is for, which changes far less often. The self-healing specs
(`tests/healing/dynamic-id.spec.ts`) start from this same page.
