# 0001. pnpm workspace with one version catalog

Accepted, November 2026.

## Context

Eleven packages share Playwright, TypeScript, zod and the test tools. Versions declared in each package drift apart, and an upgrade means editing many files.

## Decision

One pnpm workspace. Every shared dependency is pinned once in the `catalog:` of `pnpm-workspace.yaml`, and packages refer to it as `catalog:`. Workspace packages refer to each other as `workspace:*`.

## Consequences

An upgrade is one line. pnpm's strict linking catches a package that uses a dependency it does not declare. Cost: on Windows, pnpm's links can fail while another process holds files open (`scripts/install-windows.ps1` retries).
