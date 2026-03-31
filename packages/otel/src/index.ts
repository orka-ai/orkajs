export {
  OtelExporter,
  createOtelExporter,
  type OtelExporterConfig,
  type SpanData,
} from './exporter.js';

export {
  W3CTraceContextPropagator,
  traceContextPropagator,
  type TraceContext,
} from './propagator.js';
