import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '@orka-js/resilience';

describe('withRetry', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const promise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    const rejectCheck = expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 100 })).rejects.toThrow('always fails');
    await vi.runAllTimersAsync();
    await rejectCheck;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('throws immediately for non-matching retryableErrors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permission denied'));
    const rejectCheck = expect(withRetry(fn, {
      maxRetries: 3,
      retryableErrors: ['rate limit'],
      initialDelayMs: 100,
    })).rejects.toThrow('permission denied');
    await vi.runAllTimersAsync();
    await rejectCheck;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries for matching retryableErrors string pattern', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, {
      maxRetries: 3,
      retryableErrors: ['rate limit'],
      initialDelayMs: 100,
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries for matching retryableErrors RegExp pattern', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Error 429: Too Many Requests'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, {
      maxRetries: 3,
      retryableErrors: [/429/],
      initialDelayMs: 100,
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
  });

  it('calls onRetry callback with error and attempt number', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100, onRetry });
    await vi.runAllTimersAsync();
    await promise;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('uses default maxRetries of 3', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const rejectCheck = expect(withRetry(fn, { initialDelayMs: 10 })).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectCheck;
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });
});
