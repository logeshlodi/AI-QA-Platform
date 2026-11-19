# Official Playwright image: browsers and their system libraries are preinstalled.
# Keep this tag equal to @playwright/test in pnpm-workspace.yaml; CI warns when it lags
# (scripts/check-playwright-image.mjs). A lagging tag still works: see the browser install below.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

WORKDIR /work
RUN npm install -g pnpm@10

# Dependency layer first, so code changes do not reinstall packages. List every workspace package:
# a frozen install fails when a package the lockfile names is missing.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/self-healing-engine/package.json packages/self-healing-engine/
COPY packages/reporting-engine/package.json packages/reporting-engine/
COPY packages/test-data-engine/package.json packages/test-data-engine/
COPY packages/cli/package.json packages/cli/
COPY packages/data-framework/package.json packages/data-framework/
COPY packages/playwright-framework/package.json packages/playwright-framework/
COPY packages/api-framework/package.json packages/api-framework/
COPY packages/load-tests/package.json packages/load-tests/
COPY apps/order-service/package.json apps/order-service/
RUN pnpm install --frozen-lockfile --ignore-scripts
# The image ships the browsers of its own tag. If @playwright/test is newer (a Dependabot update),
# this adds the matching ones; when the versions agree it does nothing.
RUN pnpm --filter @aiqa/playwright-framework exec playwright install chromium firefox webkit

COPY . .
ENV CI=true
CMD ["pnpm", "test"]
