import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OtelExporter, createOtelExporter } from '@orka-js/otel';
import type { SpanData } from '@orka-js/otel';

const makeSpan = (overrides: Partial<SpanData> = {}): SpanData => ({
  traceId: 'a'.repeat(32),
  spanId: 'b'.repeat(16),
  name: 'test-span',
  startTimeMs: 1000,
  endTimeMs: 1100,
  kind: 0,
  status: 'ok',
  ...overrides,
});

describe('OtelExporter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('buffers spans before flush', async () => {
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318' });
    exporter.addSpan(makeSpan());
    exporter.addSpan(makeSpan({ name: 'span-2' }));
    expect(exporter.bufferedCount).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flush() sends OTLP JSON payload to /v1/traces', async () => {
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318', serviceName: 'my-svc' });
    exporter.addSpan(makeSpan({ name: 'llm/generate' }));
    await exporter.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4318/v1/traces');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.resourceSpans).toHaveLength(1);
    const resource = body.resourceSpans[0].resource.attributes;
    expect(resource.find((a: { key: string }) => a.key === 'service.name').value.stringValue).toBe('my-svc');
    const spans = body.resourceSpans[0].scopeSpans[0].spans;
    expect(spans[0].name).toBe('llm/generate');
  });

  it('re-buffers spans when flush fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318' });
    exporter.addSpan(makeSpan());
    await exporter.flush();
    expect(exporter.bufferedCount).toBe(1); // re-buffered
  });

  it('re-buffers spans when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318' });
    exporter.addSpan(makeSpan());
    await exporter.flush();
    expect(exporter.bufferedCount).toBe(1);
  });

  it('auto-flushes when batchSize is reached', async () => {
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318', batchSize: 2 });
    exporter.addSpan(makeSpan());
    exporter.addSpan(makeSpan()); // triggers flush
    // flush is async but triggered, so wait a tick
    await new Promise(r => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalled();
  });

  it('stop() flushes remaining spans', async () => {
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318' });
    exporter.addSpan(makeSpan());
    await exporter.stop();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does nothing when enabled=false', async () => {
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318', enabled: false });
    exporter.addSpan(makeSpan());
    await exporter.flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(exporter.bufferedCount).toBe(0);
  });

  it('includes custom headers in request', async () => {
    const exporter = new OtelExporter({
      endpoint: 'http://localhost:4318',
      headers: { Authorization: 'Bearer tok' },
    });
    exporter.addSpan(makeSpan());
    await exporter.flush();
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer tok');
  });

  it('createOtelExporter() starts the exporter', () => {
    const exporter = createOtelExporter({ endpoint: 'http://localhost:4318', flushIntervalMs: 60000 });
    expect(exporter).toBeInstanceOf(OtelExporter);
    exporter.stop();
  });

  it('span attributes are serialised as OTLP attributes', async () => {
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318' });
    exporter.addSpan(makeSpan({
      attributes: { 'llm.model': 'gpt-4o', 'llm.tokens': 120, 'llm.cached': true },
    }));
    await exporter.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const attrs = body.resourceSpans[0].scopeSpans[0].spans[0].attributes as Array<{ key: string; value: Record<string, unknown> }>;

    const model = attrs.find(a => a.key === 'llm.model');
    expect(model?.value.stringValue).toBe('gpt-4o');

    const tokens = attrs.find(a => a.key === 'llm.tokens');
    expect(tokens?.value.intValue).toBe('120');

    const cached = attrs.find(a => a.key === 'llm.cached');
    expect(cached?.value.boolValue).toBe(true);
  });
});
