import { describe, it, expect } from 'vitest';
import { ListParser } from '@orkajs/tools';

describe('ListParser', () => {
  const parser = new ListParser();

  describe('parse', () => {
    it('should parse numbered list', () => {
      const input = '1. First item\n2. Second item\n3. Third item';
      const result = parser.parse(input);

      expect(result).toEqual(['First item', 'Second item', 'Third item']);
    });

    it('should parse bulleted list with dashes', () => {
      const input = '- Item A\n- Item B\n- Item C';
      const result = parser.parse(input);

      expect(result).toEqual(['Item A', 'Item B', 'Item C']);
    });

    it('should parse bulleted list with asterisks', () => {
      const input = '* Item 1\n* Item 2';
      const result = parser.parse(input);

      expect(result).toEqual(['Item 1', 'Item 2']);
    });

    it('should handle mixed formats', () => {
      const input = '1. First\n- Second\n* Third';
      const result = parser.parse(input);

      expect(result.length).toBe(3);
    });

    it('should trim whitespace from items', () => {
      const input = '1.   Spaced item   \n2. Normal item';
      const result = parser.parse(input);

      expect(result[0]).toBe('Spaced item');
    });

    it('should filter empty items', () => {
      const input = '1. Item\n2. \n3. Another';
      const result = parser.parse(input);

      expect(result.every((item) => item.length > 0)).toBe(true);
    });
  });

  describe('getFormatInstructions', () => {
    it('should return format instructions', () => {
      const instructions = parser.getFormatInstructions();

      expect(instructions).toBeTruthy();
    });
  });
});
