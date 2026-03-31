/**
 * Standalone OTLP exporter for OrkaJS traces.
 * Converts generic span data to OTLP v1 JSON and POSTs to a collector endpoint.
 */

export interface OtelExporterConfig {
  /** OTLP collector endpoint (e.g. http://localhost:4318) */
  endpoint: string;
  /** Service name shown in your tracing backend */
  serviceName?: string;
  serviceVersion?: string;
  /** Extra headers (e.g. auth tokens) */
  headers?: Record<string, string>;
  /** Max spans per batch before forcing a flush */
  batchSize?: number;
  /** Flush interval in ms */
  flushIntervalMs?: number;
  enabled?: boolean;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  /** Span start time in milliseconds since epoch */
  startTimeMs: number;
  /** Span end time in milliseconds since epoch */
  endTimeMs: number;
  /** OTLP span kind: 0=INTERNAL, 3=CLIENT, 4=PRODUCER */
  kind?: number;
  status?: 'ok' | 'error';
  errorMessage?: string;
  attributes?: Record<string, string | number | boolean>;
}

interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }>;
  status: { code: number; message?: string };
}

function toOTLPAttributes(attrs: Record<string, string | number | boolean>): OTLPSpan['attributes'] {
  return Object.entries(attrs).map(([key, value]) => {
    if (typeof value === 'string') return { key, value: { stringValue: value } };
    if (typeof value === 'boolean') return { key, value: { boolValue: value } };
    if (Number.isInteger(value)) return { key, value: { intValue: String(value) } };
    return { key, value: { doubleValue: value as number } };
  });
}

export class OtelExporter {
  private config: Required<OtelExporterConfig>;
  private buffer: OTLPSpan[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: OtelExporterConfig) {
    this.config = {
      serviceName: 'orkajs-app',
      serviceVersion: '1.0.0',
      headers: {},
      batchSize: 100,
      flushIntervalMs: 5000,
      enabled: true,
      ...config,
    };
  }

  /** Start the periodic flush timer. */
  start(): void {
    if (!this.config.enabled || this.flushTimer) return;
    this.flushTimer = setInterval(() => { this.flush(); }, this.config.flushIntervalMs);
  }

  /** Stop the timer and flush remaining spans. */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flush();
  }

  /** Add a span to the buffer. Auto-flushes if batchSize is reached. */
  addSpan(span: SpanData): void {
    if (!this.config.enabled) return;

    const attrs = toOTLPAttributes({
      ...(span.attributes ?? {}),
    });
    if (span.errorMessage) {
      attrs.push({ key: 'error.message', value: { stringValue: span.errorMessage } });
    }

    const otlpSpan: OTLPSpan = {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: span.kind ?? 0,
      startTimeUnixNano: String(span.startTimeMs * 1_000_000),
      endTimeUnixNano: String(span.endTimeMs * 1_000_000),
      attributes: attrs,
      status: { code: span.status === 'error' ? 2 : 1, message: span.errorMessage },
    };

    this.buffer.push(otlpSpan);
    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /** Send buffered spans to the OTLP endpoint. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const spans = [...this.buffer];
    this.buffer = [];

    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
            { key: 'telemetry.sdk.name', value: { stringValue: '@orka-js/otel' } },
          ],
        },
        scopeSpans: [{
          scope: { name: '@orka-js/otel', version: '0.1.0' },
          spans,
        }],
      }],
    };

    try {
      const response = await fetch(`${this.config.endpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.headers },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        // Re-buffer for retry
        this.buffer.unshift(...spans);
      }
    } catch {
      // Re-buffer for retry
      this.buffer.unshift(...spans);
    }
  }

  /** Current number of buffered (unflushed) spans. */
  get bufferedCount(): number {
    return this.buffer.length;
  }
}

/** Convenience factory — creates and starts an exporter. */
export function createOtelExporter(config: OtelExporterConfig): OtelExporter {
  const exporter = new OtelExporter(config);
  exporter.start();
  return exporter;
}
