# documentation

The docs site, built with [Starlight](https://starlight.astro.build) from the Markdown in `docs/`
and published to GitHub Pages by `.github/workflows/docs.yml`.

```bash
npx pnpm docs          # dev server with live reload
npx pnpm docs:build    # what CI runs: sync, build, then check every internal link
```

`scripts/sync.ts` copies `docs/` into `src/content/docs/` (git-ignored) on every build: the first
heading becomes the page title, links between docs become site links, and links to code become
GitHub links. `scripts/check-links.ts` fails the build on any internal link that does not resolve.
Edit the files in `docs/`, never the copies.

`DOCS_BASE` sets the path the site is served under (`/AI-QA-Platform/` on GitHub Pages, `/` locally).
