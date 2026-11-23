/**
 * Where the stack is. Defaults are the ports `pnpm stack:up` publishes on localhost; inside the
 * compose network the data-tests container overrides them with service names.
 */
export const stack = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://aiqa:aiqa@localhost:5432/shop',
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017',
  mongoDb: process.env.MONGO_DB ?? 'shop',
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  serviceUrl: process.env.ORDER_SERVICE_URL ?? 'http://localhost:8088',
  /** The order service's gRPC API (host:port, no scheme). */
  grpcAddress: process.env.ORDER_GRPC_ADDRESS ?? 'localhost:50051',
  metricsUrl: process.env.ORDER_METRICS_URL ?? 'http://localhost:9464/metrics',
  /** The TLS edge in front of the order service (infrastructure/docker/edge/Caddyfile). */
  edgeHttpsUrl: process.env.EDGE_HTTPS_URL ?? 'https://localhost:8443',
  /** Plain HTTP on the edge: it only redirects to HTTPS. */
  edgeHttpUrl: process.env.EDGE_HTTP_URL ?? 'http://localhost:8089',
  /** False where no TLS edge is deployed (the Kubernetes chart sets EDGE_HTTPS_URL to "none"). */
  hasEdge: process.env.EDGE_HTTPS_URL !== 'none',
  /** Keycloak's token endpoint for the local test realm (client credentials). */
  tokenUrl: process.env.AUTH_TOKEN_URL ?? 'http://localhost:8180/realms/aiqa/protocol/openid-connect/token',
};

export const TOPICS = {
  placed: 'orders.placed',
  confirmed: 'orders.confirmed',
  rejected: 'orders.rejected',
  deadLetter: 'orders.dlq',
} as const;
