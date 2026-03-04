import type { Orka } from '../core/orka.js';
import type { EvalCase, MetricFn } from './metrics.js';
import type { Assertion, AssertionResult } from './assertions.js';
import type { Reporter, TestCaseReport, TestSuiteReport } from './reporters.js';
import { builtinMetrics } from './metrics.js';
import { ConsoleReporter } from './reporters.js';

export interface TestSuiteConfig {
  name: string;
  dataset: EvalCase[];
  metrics?: (string | MetricFn)[];
  assertions?: Assertion[];
  reporters?: Reporter[];
  concurrency?: number;
  bail?: boolean;
}

export class TestRunner {
  private orka: Orka;

  constructor(orka: Orka) {
    this.orka = orka;
  }

  async run(config: TestSuiteConfig): Promise<TestSuiteReport> {
    const startTime = Date.now();
    const {
      name,
      dataset,
      metrics = ['relevance', 'faithfulness'],
      assertions = [],
      reporters = [new ConsoleReporter()],
      concurrency = 1,
      bail = false,
    } = config;

    const resolvedMetrics = this.resolveMetrics(metrics);
    const cases: TestCaseReport[] = [];

    const batches = this.chunk(dataset, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (evalCase) => this.runCase(evalCase, resolvedMetrics, assertions))
      );

      for (const result of batchResults) {
        cases.push(result);
        if (bail && !result.passed) {
          break;
        }
      }

      if (bail && cases.some(c => !c.passed)) {
        break;
      }
    }

    const report = this.buildReport(name, cases, Date.now() - startTime);

    for (const reporter of reporters) {
      await reporter.report(report);
    }

    return report;
  }

  private async runCase(
    evalCase: EvalCase,
    metrics: MetricFn[],
    assertions: Assertion[],
  ): Promise<TestCaseReport> {
    const askResult = await this.orka.ask({
      knowledge: evalCase.knowledge,
      question: evalCase.input,
      includeContext: true,
    });

    const contextTexts = askResult.context?.map(c => c.content) ?? evalCase.context ?? [];
    const llm = this.orka.getLLM();

    const metricResults: Record<string, number> = {};
    for (const metricFn of metrics) {
      const result = await metricFn({
        input: evalCase.input,
        output: askResult.answer,
        expectedOutput: evalCase.expectedOutput,
        context: contextTexts,
        llm,
      });
      metricResults[result.name] = result.score;
    }

    const assertionResults: AssertionResult[] = assertions.map(assertion =>
      assertion.check({
        input: evalCase.input,
        output: askResult.answer,
        expectedOutput: evalCase.expectedOutput,
        metrics: metricResults,
        latencyMs: askResult.latencyMs,
        totalTokens: askResult.usage.totalTokens,
      })
    );

    const allPassed = assertionResults.length === 0 || assertionResults.every(a => a.passed);

    return {
      input: evalCase.input,
      output: askResult.answer,
      passed: allPassed,
      assertions: assertionResults,
      metrics: metricResults,
      latencyMs: askResult.latencyMs,
      totalTokens: askResult.usage.totalTokens,
    };
  }

  private buildReport(name: string, cases: TestCaseReport[], duration: number): TestSuiteReport {
    const passed = cases.filter(c => c.passed).length;
    const failed = cases.length - passed;

    const metricsMap: Record<string, number[]> = {};
    for (const c of cases) {
      for (const [metricName, score] of Object.entries(c.metrics)) {
        if (!metricsMap[metricName]) metricsMap[metricName] = [];
        metricsMap[metricName].push(score);
      }
    }

    const metricsSummary: Record<string, { average: number; min: number; max: number }> = {};
    for (const [metricName, scores] of Object.entries(metricsMap)) {
      metricsSummary[metricName] = {
        average: scores.reduce((a, b) => a + b, 0) / scores.length,
        min: Math.min(...scores),
        max: Math.max(...scores),
      };
    }

    return {
      name,
      timestamp: new Date().toISOString(),
      duration,
      totalCases: cases.length,
      passed,
      failed,
      passRate: cases.length > 0 ? passed / cases.length : 0,
      cases,
      summary: {
        averageLatencyMs: cases.reduce((a, b) => a + b.latencyMs, 0) / (cases.length || 1),
        totalTokens: cases.reduce((a, b) => a + b.totalTokens, 0),
        metrics: metricsSummary,
      },
    };
  }

  private resolveMetrics(metrics: (string | MetricFn)[]): MetricFn[] {
    return metrics.map(m => {
      if (typeof m === 'function') return m;
      const builtin = builtinMetrics[m];
      if (!builtin) throw new Error(`Unknown metric: "${m}"`);
      return builtin;
    });
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
