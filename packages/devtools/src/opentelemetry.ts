import type { TraceRun, TraceRunType, TraceEvent } from './types.js';
import { getCollector } from './collector.js';

/**
 * OpenTelemetry configuration
 */
export interface OpenTelemetryConfig {
  endpoint: string;
  serviceName?: string;
  serviceVersion?: string;
  headers?: Record<string, string>;
  batchSize?: number;
  flushIntervalMs?: number;
  enabled?: boolean;
}

/**
 * OTLP Span representation
 */
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

/**
 * OpenTelemetry Exporter for DevTools traces
 */
export class OpenTelemetryExporter {
  private config: Required<OpenTelemetryConfig>;
  private spanBuffer: OTLPSpan[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private unsubscribe?: () => void;

  constructor(config: OpenTelemetryConfig) {
    this.config = {
      endpoint: config.endpoint,
      serviceName: config.serviceName ?? 'orkajs-app',
      serviceVersion: config.serviceVersion ?? '1.0.0',
      headers: config.headers ?? {},
      batchSize: config.batchSize ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Start the exporter - subscribes to trace events
   */
  start(): void {
    if (!this.config.enabled) return;

    const collector = getCollector();
    
    this.unsubscribe = collector.subscribe((event: TraceEvent) => {
      if (event.type === 'run:end' && event.run) {
        this.addSpan(event.run, event.sessionId);
      }
    });

    // Start flush timer
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop the exporter
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Convert a TraceRun to OTLP span
   */
  private addSpan(run: TraceRun, traceId: string): void {
    const span = this.runToSpan(run, traceId);
    this.spanBuffer.push(span);

    // Also add child spans
    for (const child of run.children) {
      this.addSpan(child, traceId);
    }

    // Flush if buffer is full
    if (this.spanBuffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Convert TraceRun to OTLP Span format
   */
  private runToSpan(run: TraceRun, traceId: string): OTLPSpan {
    const attributes: OTLPSpan['attributes'] = [
      { key: 'orka.run.type', value: { stringValue: run.type } },
      { key: 'orka.run.name', value: { stringValue: run.name } },
      { key: 'orka.run.status', value: { stringValue: run.status } },
    ];

    // Add metadata as attributes
    if (run.metadata) {
      if (run.metadata.model) {
        attributes.push({ key: 'llm.model', value: { stringValue: run.metadata.model } });
      }
      if (run.metadata.provider) {
        attributes.push({ key: 'llm.provider', value: { stringValue: run.metadata.provider } });
      }
      if (run.metadata.totalTokens !== undefined) {
        attributes.push({ key: 'llm.tokens.total', value: { intValue: String(run.metadata.totalTokens) } });
      }
      if (run.metadata.promptTokens !== undefined) {
        attributes.push({ key: 'llm.tokens.prompt', value: { intValue: String(run.metadata.promptTokens) } });
      }
      if (run.metadata.completionTokens !== undefined) {
        attributes.push({ key: 'llm.tokens.completion', value: { intValue: String(run.metadata.completionTokens) } });
      }
      if (run.metadata.cost !== undefined) {
        attributes.push({ key: 'llm.cost', value: { doubleValue: run.metadata.cost } });
      }
      if (run.metadata.toolName) {
        attributes.push({ key: 'tool.name', value: { stringValue: run.metadata.toolName } });
      }
    }

    // Add latency
    if (run.latencyMs !== undefined) {
      attributes.push({ key: 'orka.latency_ms', value: { intValue: String(run.latencyMs) } });
    }

    // Add error if present
    if (run.error) {
      attributes.push({ key: 'error.message', value: { stringValue: run.error } });
    }

    return {
      traceId: this.toHex(traceId, 32),
      spanId: this.toHex(run.id, 16),
      parentSpanId: run.parentId ? this.toHex(run.parentId, 16) : undefined,
      name: `${run.type}/${run.name}`,
      kind: this.getSpanKind(run.type),
      startTimeUnixNano: String(run.startTime * 1_000_000),
      endTimeUnixNano: String((run.endTime ?? run.startTime) * 1_000_000),
      attributes,
      status: {
        code: run.status === 'error' ? 2 : 1,
        message: run.error,
      },
    };
  }

  /**
   * Get OTLP span kind based on run type
   */
  private getSpanKind(type: TraceRunType): number {
    switch (type) {
      case 'llm':
      case 'embedding':
        return 3; // CLIENT
      case 'tool':
        return 3; // CLIENT
      case 'agent':
      case 'chain':
      case 'workflow':
      case 'graph':
        return 0; // INTERNAL
      default:
        return 0; // INTERNAL
    }
  }

  /**
   * Convert string ID to hex format
   */
  private toHex(id: string, length: number): string {
    // Simple hash to hex conversion
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(length, '0');
    return hex.slice(0, length);
  }

  /**
   * Flush spans to OTLP endpoint
   */
  async flush(): Promise<void> {
    if (this.spanBuffer.length === 0) return;

    const spans = [...this.spanBuffer];
    this.spanBuffer = [];

    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
            { key: 'telemetry.sdk.name', value: { stringValue: '@orka-js/devtools' } },
            { key: 'telemetry.sdk.version', value: { stringValue: '1.1.0' } },
          ],
        },
        scopeSpans: [{
          scope: {
            name: '@orka-js/devtools',
            version: '1.1.0',
          },
          spans,
        }],
      }],
    };

    try {
      const response = await fetch(`${this.config.endpoint}/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`[DevTools] OTLP export failed: ${response.status} ${response.statusText}`);
        // Re-add spans to buffer for retry
        this.spanBuffer.unshift(...spans);
      }
    } catch (error) {
      console.error('[DevTools] OTLP export error:', error);
      // Re-add spans to buffer for retry
      this.spanBuffer.unshift(...spans);
    }
  }
}

/**
 * Create and start an OpenTelemetry exporter
 */
export function createOTLPExporter(config: OpenTelemetryConfig): OpenTelemetryExporter {
  const exporter = new OpenTelemetryExporter(config);
  exporter.start();
  return exporter;
}
