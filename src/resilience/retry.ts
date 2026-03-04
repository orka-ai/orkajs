export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (string | RegExp)[];
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_RETRY: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_RETRY.maxRetries,
    initialDelayMs = DEFAULT_RETRY.initialDelayMs,
    maxDelayMs = DEFAULT_RETRY.maxDelayMs,
    backoffMultiplier = DEFAULT_RETRY.backoffMultiplier,
    retryableErrors,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt >= maxRetries) break;

      if (retryableErrors && !isRetryable(lastError, retryableErrors)) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs,
      );
      const jitter = delay * 0.1 * Math.random();
      await sleep(delay + jitter);
    }
  }

  throw lastError;
}

function isRetryable(error: Error, patterns: (string | RegExp)[]): boolean {
  const message = error.message;
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return message.includes(pattern);
    }
    return pattern.test(message);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
