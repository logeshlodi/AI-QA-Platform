import { metrics } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { config } from './config';

/**
 * OpenTelemetry metrics, exported in Prometheus format on METRICS_PORT/metrics.
 * Prometheus scrapes them; Grafana charts them; the data suite asserts on them.
 */
// The exporter binds to localhost by default, which nothing outside a container can reach.
const exporter = new PrometheusExporter({ host: '0.0.0.0', port: config.metricsPort });
const provider = new MeterProvider({ readers: [exporter] });
metrics.setGlobalMeterProvider(provider);
const meter = metrics.getMeter('order-service');

export const ordersProcessed = meter.createCounter('orders_processed', {
  description: 'Orders handled, by outcome: confirmed, rejected, duplicate, invalid',
});
export const processingSeconds = meter.createHistogram('order_processing_seconds', {
  description: 'Time from receiving an order message to publishing the result',
  unit: 's',
  advice: { explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5] },
});

export const transactionRetries = meter.createCounter('order_transaction_retries', {
  description: 'Order transactions retried after Postgres chose them as a deadlock or serialization victim',
});

export const shutdownMetrics = () => provider.shutdown();
