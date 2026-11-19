# Built from the repository root (docker compose does this): docker build -f apps/order-service/Dockerfile .
FROM node:24-slim
WORKDIR /work
RUN npm install -g pnpm@10

# Every workspace manifest, because a frozen install checks the whole lockfile;
# only the order service's own dependencies are then installed (--filter).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/self-healing-engine/package.json packages/self-healing-engine/
COPY packages/reporting-engine/package.json packages/reporting-engine/
COPY packages/test-data-engine/package.json packages/test-data-engine/
COPY packages/cli/package.json packages/cli/
COPY packages/data-framework/package.json packages/data-framework/
COPY packages/playwright-framework/package.json packages/playwright-framework/
COPY packages/api-framework/package.json packages/api-framework/
COPY apps/order-service/package.json apps/order-service/
RUN pnpm install --frozen-lockfile --filter @aiqa/order-service --ignore-scripts

COPY apps/order-service apps/order-service
WORKDIR /work/apps/order-service
ENV NODE_ENV=production
EXPOSE 8080 9464
# Node itself is the container's main process, so the service's own SIGTERM handler closes Kafka,
# Postgres and MongoDB and exits 0. Through pnpm and the tsx CLI, a clean stop was reported as exit 1.
CMD ["node", "--import", "tsx", "src/main.ts"]
