import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * Distributed tracing with OpenTelemetry, on when OTEL_EXPORTER_OTLP_ENDPOINT is set (the Kubernetes
 * chart points it at Tempo). One order becomes one trace: the HTTP request that placed it, the Kafka
 * hop (trace context travels in the message headers, W3C traceparent), and the Postgres and MongoDB
 * calls that handled it.
 *
 * Import this module first: the Postgres and MongoDB instrumentations patch those libraries when
 * they are loaded, so they must be registered before anything requires them.
 */
const enabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
let provider: TracerProvider | undefined;

if (enabled) {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  provider = new TracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'order-service',
    }),
    // The exporter reads OTEL_EXPORTER_OTLP_ENDPOINT and sends to its /v1/traces.
    spanProcessors: [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })],
  });
  trace.setGlobalTracerProvider(provider);
  registerInstrumentations({
    instrumentations: [
      // Health checks every few seconds would drown out the orders.
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => req.url === '/health' }),
      new PgInstrumentation(),
      new MongoDBInstrumentation(),
    ],
  });
}

const tracer = trace.getTracer('order-service');

/** W3C trace headers for the current span, to send with a Kafka message. Empty when tracing is off. */
export function traceHeaders(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/**
 * Runs `fn` as the processing span of a Kafka message, as a child of the trace that produced the
 * message when its headers carry one. Postgres and MongoDB calls inside become its children.
 */
export async function inMessageSpan<T>(
  name: string,
  headers: Map<string, string> | undefined,
  attributes: Record<string, string | number>,
  fn: () => Promise<T>,
): Promise<T> {
  const parent = propagation.extract(context.active(), Object.fromEntries(headers ?? []));
  return tracer.startActiveSpan(name, { kind: SpanKind.CONSUMER, attributes }, parent, async (span) => {
    try {
      return await fn();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/** The current trace id, for log lines (Grafana links a log line to its trace). */
export function currentTraceId(): string | undefined {
  const id = trace.getActiveSpan()?.spanContext().traceId;
  return id && id !== '00000000000000000000000000000000' ? id : undefined;
}

export const shutdownTracing = async () => {
  await provider?.shutdown();
};
