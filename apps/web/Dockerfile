# The web app as a container, for the Kubernetes stack. From the repository root:
#   docker build -f apps/web/Dockerfile .
FROM node:24-slim AS build
WORKDIR /work
RUN npm install -g pnpm@10

# Every workspace manifest, because a frozen install checks the whole lockfile; then only the web
# app and the workspace packages it uses are installed.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ai-agents/package.json packages/ai-agents/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/api-framework/package.json packages/api-framework/
COPY packages/cli/package.json packages/cli/
COPY packages/contract-tests/package.json packages/contract-tests/
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/data-framework/package.json packages/data-framework/
COPY packages/examples/package.json packages/examples/
COPY packages/interview-learning/package.json packages/interview-learning/
COPY packages/load-tests/package.json packages/load-tests/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/playwright-framework/package.json packages/playwright-framework/
COPY packages/reporting-engine/package.json packages/reporting-engine/
COPY packages/self-healing-engine/package.json packages/self-healing-engine/
COPY packages/shared/package.json packages/shared/
COPY packages/templates/package.json packages/templates/
COPY packages/test-data-engine/package.json packages/test-data-engine/
COPY apps/documentation/package.json apps/documentation/
COPY apps/order-service/package.json apps/order-service/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@aiqa/web..." --ignore-scripts

COPY . .
# A standalone build: the server and only the files it needs (Next.js traces them).
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @aiqa/web exec next build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3200 HOSTNAME=0.0.0.0
COPY --from=build /work/apps/web/.next/standalone ./
COPY --from=build /work/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3200
CMD ["node", "apps/web/server.js"]
