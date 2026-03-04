export interface Assertion {
  name: string;
  check(params: AssertionParams): AssertionResult;
}

export interface AssertionParams {
  input: string;
  output: string;
  expectedOutput?: string;
  metrics: Record<string, number>;
  latencyMs: number;
  totalTokens: number;
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export function minScore(metricName: string, threshold: number): Assertion {
  return {
    name: `${metricName} >= ${threshold}`,
    check({ metrics }) {
      const actual = metrics[metricName];
      if (actual === undefined) {
        return { name: this.name, passed: false, message: `Metric "${metricName}" not found`, expected: threshold, actual: undefined };
      }
      return {
        name: this.name,
        passed: actual >= threshold,
        message: actual >= threshold ? `${metricName}=${actual.toFixed(3)} >= ${threshold}` : `${metricName}=${actual.toFixed(3)} < ${threshold}`,
        expected: threshold,
        actual,
      };
    },
  };
}

export function maxScore(metricName: string, threshold: number): Assertion {
  return {
    name: `${metricName} <= ${threshold}`,
    check({ metrics }) {
      const actual = metrics[metricName];
      if (actual === undefined) {
        return { name: this.name, passed: false, message: `Metric "${metricName}" not found`, expected: threshold, actual: undefined };
      }
      return {
        name: this.name,
        passed: actual <= threshold,
        message: actual <= threshold ? `${metricName}=${actual.toFixed(3)} <= ${threshold}` : `${metricName}=${actual.toFixed(3)} > ${threshold}`,
        expected: threshold,
        actual,
      };
    },
  };
}

export function maxLatency(ms: number): Assertion {
  return {
    name: `latency <= ${ms}ms`,
    check({ latencyMs }) {
      return {
        name: this.name,
        passed: latencyMs <= ms,
        message: latencyMs <= ms ? `${latencyMs}ms <= ${ms}ms` : `${latencyMs}ms > ${ms}ms`,
        expected: ms,
        actual: latencyMs,
      };
    },
  };
}

export function maxTokens(max: number): Assertion {
  return {
    name: `tokens <= ${max}`,
    check({ totalTokens }) {
      return {
        name: this.name,
        passed: totalTokens <= max,
        message: totalTokens <= max ? `${totalTokens} <= ${max}` : `${totalTokens} > ${max}`,
        expected: max,
        actual: totalTokens,
      };
    },
  };
}

export function contains(text: string): Assertion {
  return {
    name: `output contains "${text}"`,
    check({ output }) {
      const passed = output.toLowerCase().includes(text.toLowerCase());
      return {
        name: this.name,
        passed,
        message: passed ? `Output contains "${text}"` : `Output does not contain "${text}"`,
        expected: text,
      };
    },
  };
}

export function notContains(text: string): Assertion {
  return {
    name: `output does not contain "${text}"`,
    check({ output }) {
      const passed = !output.toLowerCase().includes(text.toLowerCase());
      return {
        name: this.name,
        passed,
        message: passed ? `Output does not contain "${text}"` : `Output contains "${text}"`,
        expected: `not "${text}"`,
      };
    },
  };
}

export function matchesRegex(pattern: RegExp): Assertion {
  return {
    name: `output matches ${pattern}`,
    check({ output }) {
      const passed = pattern.test(output);
      return {
        name: this.name,
        passed,
        message: passed ? `Output matches ${pattern}` : `Output does not match ${pattern}`,
        expected: pattern.toString(),
      };
    },
  };
}

export function customAssertion(name: string, fn: (params: AssertionParams) => boolean, failMessage?: string): Assertion {
  return {
    name,
    check(params) {
      const passed = fn(params);
      return {
        name,
        passed,
        message: passed ? `${name}: passed` : (failMessage ?? `${name}: failed`),
      };
    },
  };
}
