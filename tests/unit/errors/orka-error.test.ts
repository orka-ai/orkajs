import { describe, it, expect } from 'vitest';
import { OrkaError, OrkaErrorCode } from '@orkajs/core';

describe('OrkaError', () => {
  describe('OrkaError class', () => {
    it('should create error with message, code and module', () => {
      const error = new OrkaError('Test error', OrkaErrorCode.LLM_API_ERROR, 'openai');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(OrkaErrorCode.LLM_API_ERROR);
      expect(error.module).toBe('openai');
      expect(error.name).toBe('OrkaError');
    });

    it('should include module context', () => {
      const error = new OrkaError('Test error', OrkaErrorCode.CACHE_ERROR, 'cache');

      expect(error.module).toBe('cache');
    });

    it('should wrap cause error', () => {
      const cause = new Error('Original error');
      const error = new OrkaError('Wrapped error', OrkaErrorCode.LLM_API_ERROR, 'openai', cause);

      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error', () => {
      const error = new OrkaError('Test', OrkaErrorCode.PARSE_ERROR, 'parser');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof OrkaError).toBe(true);
    });

    it('should include metadata', () => {
      const error = new OrkaError(
        'Test',
        OrkaErrorCode.LLM_API_ERROR,
        'openai',
        undefined,
        { requestId: '123' }
      );

      expect(error.metadata).toEqual({ requestId: '123' });
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new OrkaError('Test error', OrkaErrorCode.PARSE_ERROR, 'parser');
      const json = error.toJSON();

      expect(json.name).toBe('OrkaError');
      expect(json.code).toBe(OrkaErrorCode.PARSE_ERROR);
      expect(json.module).toBe('parser');
      expect(json.message).toBe('Test error');
    });
  });

  describe('isOrkaError', () => {
    it('should return true for OrkaError instances', () => {
      const error = new OrkaError('Test', OrkaErrorCode.PARSE_ERROR, 'parser');

      expect(OrkaError.isOrkaError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Regular error');

      expect(OrkaError.isOrkaError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(OrkaError.isOrkaError('string')).toBe(false);
      expect(OrkaError.isOrkaError(null)).toBe(false);
    });
  });

  describe('isRetryable (static)', () => {
    it('should mark rate limit errors as retryable', () => {
      const error = new OrkaError('Rate limited', OrkaErrorCode.LLM_RATE_LIMIT, 'openai');

      expect(OrkaError.isRetryable(error)).toBe(true);
    });

    it('should mark timeout errors as retryable', () => {
      const error = new OrkaError('Timeout', OrkaErrorCode.LLM_TIMEOUT, 'openai');

      expect(OrkaError.isRetryable(error)).toBe(true);
    });

    it('should mark API errors as retryable', () => {
      const error = new OrkaError('API error', OrkaErrorCode.LLM_API_ERROR, 'openai');

      expect(OrkaError.isRetryable(error)).toBe(true);
    });

    it('should not mark validation errors as retryable', () => {
      const error = new OrkaError('Bad input', OrkaErrorCode.VALIDATION_ERROR, 'parser');

      expect(OrkaError.isRetryable(error)).toBe(false);
    });

    it('should return false for non-OrkaError', () => {
      const error = new Error('Regular error');

      expect(OrkaError.isRetryable(error)).toBe(false);
    });
  });

  describe('OrkaErrorCode enum', () => {
    it('should have LLM error codes', () => {
      expect(OrkaErrorCode.LLM_API_ERROR).toBe('LLM_API_ERROR');
      expect(OrkaErrorCode.LLM_TIMEOUT).toBe('LLM_TIMEOUT');
      expect(OrkaErrorCode.LLM_RATE_LIMIT).toBe('LLM_RATE_LIMIT');
    });

    it('should have agent error codes', () => {
      expect(OrkaErrorCode.AGENT_MAX_STEPS).toBe('AGENT_MAX_STEPS');
      expect(OrkaErrorCode.AGENT_TOOL_NOT_FOUND).toBe('AGENT_TOOL_NOT_FOUND');
    });

    it('should have security error codes', () => {
      expect(OrkaErrorCode.SQL_INJECTION_BLOCKED).toBe('SQL_INJECTION_BLOCKED');
      expect(OrkaErrorCode.SSRF_BLOCKED).toBe('SSRF_BLOCKED');
    });
  });
});
