import { describe, it, expect } from 'vitest';
import { W3CTraceContextPropagator, traceContextPropagator } from '@orka-js/otel';

describe('W3CTraceContextPropagator', () => {
  const p = new W3CTraceContextPropagator();

  describe('generate()', () => {
    it('produces a 32-char hex traceId', () => {
      const ctx = p.generate();
      expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('produces a 16-char hex spanId', () => {
      const ctx = p.generate();
      expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('sets sampled=true by default', () => {
      const ctx = p.generate();
      expect(ctx.sampled).toBe(true);
    });

    it('generates unique IDs on each call', () => {
      const a = p.generate();
      const b = p.generate();
      expect(a.traceId).not.toBe(b.traceId);
    });
  });

  describe('child()', () => {
    it('inherits the traceId from parent', () => {
      const parent = p.generate();
      const child = p.child(parent);
      expect(child.traceId).toBe(parent.traceId);
    });

    it('generates a new spanId', () => {
      const parent = p.generate();
      const child = p.child(parent);
      expect(child.spanId).not.toBe(parent.spanId);
    });

    it('inherits sampled flag', () => {
      const parent = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), sampled: false };
      const child = p.child(parent);
      expect(child.sampled).toBe(false);
    });
  });

  describe('inject()', () => {
    it('produces a valid traceparent header', () => {
      const ctx = { traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: '00f067aa0ba902b7', sampled: true };
      const headers = p.inject(ctx);
      expect(headers.traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    });

    it('sets flags=00 when sampled=false', () => {
      const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), sampled: false };
      const headers = p.inject(ctx);
      expect(headers.traceparent.endsWith('-00')).toBe(true);
    });
  });

  describe('extract()', () => {
    it('parses a valid traceparent header', () => {
      const headers = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' };
      const ctx = p.extract(headers);
      expect(ctx?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(ctx?.spanId).toBe('00f067aa0ba902b7');
      expect(ctx?.sampled).toBe(true);
    });

    it('returns null for missing header', () => {
      expect(p.extract({})).toBeNull();
    });

    it('returns null for malformed traceparent', () => {
      expect(p.extract({ traceparent: 'invalid' })).toBeNull();
    });

    it('detects sampled=false from flags=00', () => {
      const headers = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00' };
      const ctx = p.extract(headers);
      expect(ctx?.sampled).toBe(false);
    });
  });

  describe('inject/extract roundtrip', () => {
    it('round-trips a generated context through headers', () => {
      const original = p.generate();
      const headers = p.inject(original);
      const extracted = p.extract(headers as Record<string, string>);
      expect(extracted?.traceId).toBe(original.traceId);
      expect(extracted?.spanId).toBe(original.spanId);
      expect(extracted?.sampled).toBe(original.sampled);
    });
  });

  describe('hasContext()', () => {
    it('returns true when traceparent is present and valid', () => {
      const headers = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' };
      expect(p.hasContext(headers)).toBe(true);
    });

    it('returns false when no traceparent', () => {
      expect(p.hasContext({})).toBe(false);
    });
  });

  it('traceContextPropagator is a singleton instance', () => {
    expect(traceContextPropagator).toBeInstanceOf(W3CTraceContextPropagator);
  });
});
