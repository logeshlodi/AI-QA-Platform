# github-actions

The GitHub Actions workflows live where GitHub reads them, in [`.github/workflows`](../../.github/workflows):

- `ci.yml`: type-check, lint and unit tests; API specs; UI specs in three shards with a merged
  report; smoke in real Chrome and Edge; the Lighthouse audit; the visual check; the data suites on
  the Docker stack. Nightly at 07:00 IST as well as on every push and pull request.
- `dependabot-automerge.yml`: merges patch and minor Dependabot updates once CI is green.

Every job uses the shared setup action in [`.github/actions/setup`](../../.github/actions/setup).
