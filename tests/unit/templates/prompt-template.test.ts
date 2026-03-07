import { describe, it, expect } from 'vitest';
import { PromptTemplate } from '../../../src/templates/prompt-template.js';

describe('PromptTemplate', () => {
  describe('format', () => {
    it('should replace single variable', () => {
      const template = new PromptTemplate({
        template: 'Hello, {{name}}!',
        inputVariables: ['name'],
      });
      const result = template.format({ name: 'World' });

      expect(result).toBe('Hello, World!');
    });

    it('should replace multiple variables', () => {
      const template = new PromptTemplate({
        template: '{{greeting}}, {{name}}! Welcome to {{place}}.',
        inputVariables: ['greeting', 'name', 'place'],
      });
      const result = template.format({
        greeting: 'Hello',
        name: 'Alice',
        place: 'Wonderland',
      });

      expect(result).toBe('Hello, Alice! Welcome to Wonderland.');
    });

    it('should handle repeated variables', () => {
      const template = new PromptTemplate({
        template: '{{name}} said: "My name is {{name}}"',
        inputVariables: ['name'],
      });
      const result = template.format({ name: 'Bob' });

      expect(result).toBe('Bob said: "My name is Bob"');
    });

    it('should throw on missing variables', () => {
      const template = new PromptTemplate({
        template: 'Hello, {{name}}!',
        inputVariables: ['name'],
      });

      expect(() => template.format({})).toThrow();
    });

    it('should handle empty template', () => {
      const template = new PromptTemplate({
        template: '',
        inputVariables: [],
      });
      const result = template.format({});

      expect(result).toBe('');
    });

    it('should preserve JSON braces (single braces)', () => {
      const template = new PromptTemplate({
        template: 'JSON: {"key": "{{value}}"}',
        inputVariables: ['value'],
      });
      const result = template.format({ value: 'test' });

      expect(result).toContain('"key": "test"');
    });
  });

  describe('fromTemplate', () => {
    it('should auto-detect input variables', () => {
      const template = PromptTemplate.fromTemplate('Hello {{name}}, you are {{age}} years old');
      const vars = template.getInputVariables();

      expect(vars).toContain('name');
      expect(vars).toContain('age');
    });
  });

  describe('partial', () => {
    it('should create partial template with some variables filled', () => {
      const template = new PromptTemplate({
        template: '{{greeting}}, {{name}}!',
        inputVariables: ['greeting', 'name'],
      });
      const partial = template.partial({ greeting: 'Hello' });
      const result = partial.format({ name: 'World' });

      expect(result).toBe('Hello, World!');
    });
  });

  describe('getInputVariables', () => {
    it('should return list of input variables', () => {
      const template = new PromptTemplate({
        template: '{{a}} and {{b}}',
        inputVariables: ['a', 'b'],
      });

      expect(template.getInputVariables()).toEqual(['a', 'b']);
    });
  });

  describe('getTemplate', () => {
    it('should return the template string', () => {
      const template = new PromptTemplate({
        template: 'Test template',
        inputVariables: [],
      });

      expect(template.getTemplate()).toBe('Test template');
    });
  });
});
