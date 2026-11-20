# 0006. Run history in Node's built-in SQLite, with a JSON fallback

Accepted, November 2026.

## Context

Trends and flaky detection need every run kept. A native SQLite module (better-sqlite3) needs a compiler on some machines.

## Decision

The reporter writes through a `RunRepository` interface. On Node versions with `node:sqlite` it uses that; otherwise it writes one JSON file per run. Rollback journal, not WAL, so a reader without write access (a CI step reading what a root container wrote) can open the file.

## Consequences

No native build step. The same tests run against both stores. The history is per machine; CI keeps its own copy in the Actions cache.
