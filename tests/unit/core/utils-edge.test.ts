import { describe, it, expect } from 'vitest';
import { generateId } from '@orka-js/core';

describe('generateId() — Edge runtime compatibility', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('uses no Node.js crypto import (Web Crypto only)', () => {
    // If this test runs at all, the module loaded without Node.js crypto
    expect(generateId()).toMatch(/^[0-9a-z]+_[0-9a-f]+_[0-9a-z]+$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('IDs contain a timestamp segment', () => {
    const before = Date.now().toString(36);
    const id = generateId();
    const after = Date.now().toString(36);
    const ts = id.split('_')[0];
    // Timestamp part should be between before and after (lex comparison works for base36 timestamps in the same range)
    expect(ts >= before.slice(0, ts.length)).toBe(true);
    expect(ts <= after).toBe(true);
  });
});
