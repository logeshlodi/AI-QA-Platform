/**
 * Where the stack is. Defaults are the ports `pnpm stack:up` publishes on localhost; inside the
 * compose network the data-tests container overrides them with service names.
 */
export const stack = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://aiqa:aiqa@localhost:5432/shop',
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017',
  mongoDb: process.env.MONGO_DB ?? 'shop',
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  serviceUrl: process.env.ORDER_SERVICE_URL ?? 'http://localhost:8088',
  metricsUrl: process.env.ORDER_METRICS_URL ?? 'http://localhost:9464/metrics',
};

export const TOPICS = {
  placed: 'orders.placed',
  confirmed: 'orders.confirmed',
  rejected: 'orders.rejected',
  deadLetter: 'orders.dlq',
} as const;
