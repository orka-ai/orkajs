/**
 * W3C TraceContext propagator for distributed tracing.
 *
 * Implements the W3C Trace Context spec:
 * https://www.w3.org/TR/trace-context/
 *
 * traceparent format: 00-{32-hex traceId}-{16-hex spanId}-{8-bit flags}
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  /** Sampling flag: true = sampled (01), false = not sampled (00) */
  sampled?: boolean;
}

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export class W3CTraceContextPropagator {
  /**
   * Generate a new random trace context.
   * Uses Web Crypto API (works in Edge runtimes, browsers, Node.js 15+).
   */
  generate(): TraceContext {
    const traceId = this.randomHex(32);
    const spanId = this.randomHex(16);
    return { traceId, spanId, sampled: true };
  }

  /**
   * Create a child span from an existing trace context (same traceId, new spanId).
   */
  child(parent: TraceContext): TraceContext {
    return { traceId: parent.traceId, spanId: this.randomHex(16), sampled: parent.sampled };
  }

  /**
   * Inject trace context into HTTP headers.
   * @returns Object with `traceparent` (and optionally `tracestate`) headers.
   */
  inject(ctx: TraceContext): { traceparent: string; tracestate?: string } {
    const flags = (ctx.sampled ?? true) ? '01' : '00';
    return { traceparent: `00-${ctx.traceId}-${ctx.spanId}-${flags}` };
  }

  /**
   * Extract trace context from HTTP headers.
   * @returns TraceContext if a valid `traceparent` header is present, otherwise null.
   */
  extract(headers: Record<string, string | string[] | undefined>): TraceContext | null {
    const raw = Array.isArray(headers['traceparent'])
      ? headers['traceparent'][0]
      : headers['traceparent'];
    if (!raw) return null;

    const match = raw.trim().toLowerCase().match(TRACEPARENT_REGEX);
    if (!match) return null;

    const [, traceId, spanId, flags] = match;
    const sampled = (parseInt(flags, 16) & 1) === 1;
    return { traceId, spanId, sampled };
  }

  /**
   * Return true if the given headers contain a valid traceparent.
   */
  hasContext(headers: Record<string, string | string[] | undefined>): boolean {
    return this.extract(headers) !== null;
  }

  private randomHex(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  }
}

/** Singleton instance for convenience. */
export const traceContextPropagator = new W3CTraceContextPropagator();
