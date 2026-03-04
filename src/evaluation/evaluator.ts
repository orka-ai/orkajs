import type { LLMAdapter } from '../types/index.js';
import type { Orka } from '../core/orka.js';
import type { 
  EvalCase, 
  EvalResult, 
  EvalSummary, 
  MetricFn, 
  MetricResult 
} from './metrics.js';
import { builtinMetrics } from './metrics.js';

export interface EvaluateOptions {
  dataset: EvalCase[];
  metrics?: (string | MetricFn)[];
  concurrency?: number;
  onResult?: (result: EvalResult, index: number) => void;
}

export class Evaluator {
  private orka: Orka;
  private llm: LLMAdapter;

  constructor(orka: Orka, llm: LLMAdapter) {
    this.orka = orka;
    this.llm = llm;
  }

  async evaluate(options: EvaluateOptions): Promise<EvalSummary> {
    const { 
      dataset, 
      metrics = ['relevance', 'faithfulness'],
      concurrency = 1,
      onResult,
    } = options;

    const resolvedMetrics = this.resolveMetrics(metrics);
    const results: EvalResult[] = [];

    const batches = this.chunk(dataset, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (evalCase) => {
          const startTime = Date.now();

          const askResult = await this.orka.ask({
            knowledge: evalCase.knowledge,
            question: evalCase.input,
            includeContext: true,
          });

          const contextTexts = askResult.context?.map(c => c.content) ?? evalCase.context ?? [];

          const metricResults: MetricResult[] = [];
          for (const metricFn of resolvedMetrics) {
            const metricResult = await metricFn({
              input: evalCase.input,
              output: askResult.answer,
              expectedOutput: evalCase.expectedOutput,
              context: contextTexts,
              llm: this.llm,
            });
            metricResults.push(metricResult);
          }

          const costMetric = metricResults.find(m => m.name === 'cost');
          if (costMetric) {
            costMetric.score = askResult.usage.totalTokens;
            costMetric.details = {
              promptTokens: askResult.usage.promptTokens,
              completionTokens: askResult.usage.completionTokens,
              totalTokens: askResult.usage.totalTokens,
            };
          }

          const evalResult: EvalResult = {
            input: evalCase.input,
            output: askResult.answer,
            expectedOutput: evalCase.expectedOutput,
            metrics: metricResults,
            latencyMs: Date.now() - startTime,
            usage: {
              promptTokens: askResult.usage.promptTokens,
              completionTokens: askResult.usage.completionTokens,
              totalTokens: askResult.usage.totalTokens,
            },
          };

          return evalResult;
        })
      );

      for (const result of batchResults) {
        results.push(result);
        if (onResult) {
          onResult(result, results.length - 1);
        }
      }
    }

    return this.buildSummary(results);
  }

  private resolveMetrics(metrics: (string | MetricFn)[]): MetricFn[] {
    return metrics.map(m => {
      if (typeof m === 'function') return m;
      const builtin = builtinMetrics[m];
      if (!builtin) {
        throw new Error(`Unknown metric: "${m}". Available: ${Object.keys(builtinMetrics).join(', ')}`);
      }
      return builtin;
    });
  }

  private buildSummary(results: EvalResult[]): EvalSummary {
    const metricsMap: Record<string, number[]> = {};

    for (const result of results) {
      for (const metric of result.metrics) {
        if (!metricsMap[metric.name]) {
          metricsMap[metric.name] = [];
        }
        metricsMap[metric.name].push(metric.score);
      }
    }

    const metricsSummary: Record<string, { average: number; min: number; max: number }> = {};
    for (const [name, scores] of Object.entries(metricsMap)) {
      metricsSummary[name] = {
        average: scores.reduce((a, b) => a + b, 0) / scores.length,
        min: Math.min(...scores),
        max: Math.max(...scores),
      };
    }

    return {
      totalCases: results.length,
      averageLatencyMs: results.reduce((a, b) => a + b.latencyMs, 0) / results.length,
      totalTokens: results.reduce((a, b) => a + b.usage.totalTokens, 0),
      metrics: metricsSummary,
      results,
    };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
