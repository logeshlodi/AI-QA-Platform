# Official Playwright image: browsers and their system libraries are preinstalled.
# Keep this tag equal to the @playwright/test version in pnpm-workspace.yaml.
FROM mcr.microsoft.com/playwright:v1.65.0-noble

WORKDIR /work
RUN npm install -g pnpm@10

# Dependency layer first, so code changes do not reinstall packages.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/self-healing-engine/package.json packages/self-healing-engine/
COPY packages/playwright-framework/package.json packages/playwright-framework/
COPY packages/api-framework/package.json packages/api-framework/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
ENV CI=true
CMD ["pnpm", "test"]
