export const config = {
  port: Number(process.env.PORT ?? 8080),
  metricsPort: Number(process.env.METRICS_PORT ?? 9464),
  /** The gRPC API (proto/orders.proto). */
  grpcPort: Number(process.env.GRPC_PORT ?? 50051),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://aiqa:aiqa@localhost:5432/shop',
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017',
  mongoDb: process.env.MONGO_DB ?? 'shop',
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  /**
   * Handle the partitions of orders.placed in parallel (one message at a time within each).
   * PARALLEL_PARTITIONS=false brings back one message at a time overall, to compare the two.
   */
  parallelPartitions: process.env.PARALLEL_PARTITIONS !== 'false',
  /** Order outcomes are also fanned out on RabbitMQ when this is set (notifications.ts). */
  rabbitmqUrl: process.env.RABBITMQ_URL || undefined,
};

/** Topic names are the contract with the outside world: tests and other services use these. */
export const TOPICS = {
  placed: 'orders.placed',
  confirmed: 'orders.confirmed',
  rejected: 'orders.rejected',
  deadLetter: 'orders.dlq',
} as const;
