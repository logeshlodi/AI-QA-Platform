# dashboard

The React components the web app (`apps/web`) is built from: the app shell, run and test tables, a
trend chart, and the flaky, heal and agent-run tables. They take plain view models (`src/types.ts`),
not engine types, so a story can render any state without a database.

## Stories and component tests

Component tests use Playwright's stories model (Playwright 1.62+): no component-testing package, only
the built-in `mount` fixture.

- A **story** is one state of a component, a named export in a `*.story.tsx` file next to it:
  `RunTable.story.tsx` exports `Recent` and `Empty`. Its id is its path under `src/` plus the export:
  `components/RunTable/Recent` (any unique ending works: `RunTable/Recent`).
- The **gallery** (`playwright/gallery`) is a page Vite serves that renders a story on
  `window.mount({ story, props })`. `mount('RunTable/Recent')` in a test navigates there and calls it.
- Where a component takes callbacks, the story keeps the state and the test reads it from the page.

```bash
pnpm test:components          # behaviour and axe on every story (from the root)
pnpm gallery                  # browse: http://localhost:3100/playwright/gallery/index.html
```

| Spec                      | What it checks                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `tables.spec.ts`          | Rows, links, statuses in words, filtering by status, keyboard use, empty states     |
| `chart-and-shell.spec.ts` | Hover and arrow-key tooltips, the table view of a chart, `update()` on the shell    |
| `a11y.spec.ts`            | axe (WCAG 2.2 AA) on every story in `tests/components/stories.ts`, light and dark   |
| `visual.spec.ts`          | A screenshot of every story against Linux baselines (`@visual`, `PW_VISUAL=1` only) |

## Visual baselines

Screenshots differ between operating systems, so the baselines are made in the Playwright Docker
image that CI runs in, and the visual specs are off unless `PW_VISUAL=1`. After a deliberate change:

```bash
docker compose -f infrastructure/docker/docker-compose.yml run --rm --build dashboard-snapshots
```

Commit the PNGs under `tests/components/__screenshots__`.

## Colours

Roles, not hex, in `src/styles.css`: surfaces, text, a single accent for the one series a chart draws,
and status colours that always come with an icon shape and a word. Light and dark values are chosen
separately (`prefers-color-scheme`, or `data-theme="dark"` on any element).
