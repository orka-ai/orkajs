import { describe, it, expect } from 'vitest';
import { JSONParser } from '../../../src/parsers/json-parser.js';

describe('JSONParser', () => {
  const parser = new JSONParser();

  describe('parse', () => {
    it('should parse valid JSON object', () => {
      const input = '{"name": "test", "value": 123}';
      const result = parser.parse(input);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should wrap arrays in object when not strict', () => {
      const input = '[1, 2, 3]';
      const result = parser.parse(input);

      expect(result).toEqual({ value: [1, 2, 3] });
    });

    it('should extract JSON from markdown code blocks', () => {
      const input = '```json\n{"key": "value"}\n```';
      const result = parser.parse(input);

      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from text with surrounding content', () => {
      const input = 'Here is the result: {"data": true} and more text';
      const result = parser.parse(input);

      expect(result).toEqual({ data: true });
    });

    it('should throw on invalid JSON', () => {
      const input = 'not valid json at all';

      expect(() => parser.parse(input)).toThrow();
    });

    it('should handle nested objects', () => {
      const input = '{"outer": {"inner": {"deep": 42}}}';
      const result = parser.parse(input);

      expect(result).toEqual({ outer: { inner: { deep: 42 } } });
    });

    it('should parse array and wrap in object when not strict', () => {
      const input = '[1, 2, 3]';
      const result = parser.parse(input);

      expect(result).toEqual({ value: [1, 2, 3] });
    });

    it('should throw on array in strict mode', () => {
      const strictParser = new JSONParser({ strict: true });
      const input = '[1, 2, 3]';

      expect(() => strictParser.parse(input)).toThrow('Expected a JSON object');
    });
  });

  describe('getFormatInstructions', () => {
    it('should return format instructions', () => {
      const instructions = parser.getFormatInstructions();

      expect(instructions).toContain('JSON');
    });
  });
});
