import { describe, it, expect } from 'vitest';
import { StructuredOutputParser } from '@orka-js/tools';
import type { ZodLikeSchema } from '@orka-js/core';

// Hand-rolled mock schema — no real Zod dependency needed in tests
const makeSchema = <T>(validator: (d: unknown) => T, shape?: Record<string, string>): ZodLikeSchema<T> => ({
  shape,
  parse: validator,
  safeParse: (d) => {
    try {
      return { success: true, data: validator(d) };
    } catch (e) {
      return { success: false, error: { message: (e as Error).message, issues: [{ path: [], message: (e as Error).message }] } };
    }
  },
});

const productSchema = makeSchema<{ name: string; price: number }>(
  (d) => {
    const obj = d as Record<string, unknown>;
    if (typeof obj.name !== 'string') throw new Error('name must be a string');
    if (typeof obj.price !== 'number') throw new Error('price must be a number');
    return obj as { name: string; price: number };
  },
  { name: 'string', price: 'number' },
);

describe('StructuredOutputParser', () => {
  describe('parse()', () => {
    it('parses valid JSON string into typed object', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      const result = parser.parse('{"name":"iPhone","price":999}');
      expect(result.name).toBe('iPhone');
      expect(result.price).toBe(999);
    });

    it('extracts JSON from markdown code block', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      const result = parser.parse('```json\n{"name":"iPhone","price":999}\n```');
      expect(result.name).toBe('iPhone');
    });

    it('extracts JSON embedded in prose', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      const result = parser.parse('Here is the result: {"name":"iPhone","price":999} done.');
      expect(result.name).toBe('iPhone');
    });

    it('throws on invalid JSON', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      expect(() => parser.parse('not valid json')).toThrow('Failed to parse JSON');
    });

    it('throws with validation details when schema validation fails', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      expect(() => parser.parse('{"name":123,"price":"wrong"}')).toThrow('Validation failed');
    });

    it('skips safeParse and uses parse() in strict:false mode', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema, { strict: false });
      // Even with schema mismatch, strict:false uses parse() which may not throw depending on validator
      const result = parser.parse('{"name":"test","price":10}');
      expect(result).toBeDefined();
    });
  });

  describe('fromZodSchema()', () => {
    it('creates a parser from a schema', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      expect(parser).toBeInstanceOf(StructuredOutputParser);
    });

    it('forwards strict option', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema, { strict: false });
      expect(parser).toBeInstanceOf(StructuredOutputParser);
    });
  });

  describe('getFormatInstructions()', () => {
    it('returns a string describing the expected format', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      const instructions = parser.getFormatInstructions();
      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(10);
    });

    it('includes field names from schema shape', () => {
      const parser = StructuredOutputParser.fromZodSchema(productSchema);
      const instructions = parser.getFormatInstructions();
      expect(instructions).toContain('name');
      expect(instructions).toContain('price');
    });
  });

  describe('constructor()', () => {
    it('accepts schema via constructor options', () => {
      const parser = new StructuredOutputParser({ schema: productSchema });
      const result = parser.parse('{"name":"test","price":5}');
      expect(result.name).toBe('test');
    });

    it('defaults to strict:true', () => {
      const parser = new StructuredOutputParser({ schema: productSchema });
      expect(() => parser.parse('{"wrong":true}')).toThrow();
    });
  });
});
