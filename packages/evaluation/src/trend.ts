import { readFile, readdir } from 'node:fs/promises';
import { dirname, basename, resolve, join } from 'node:path';
import type { TestSuiteReport } from './reporters.js';

export interface SuiteRunSummary {
  timestamp: string;
  passRate: number;
  metrics: Record<string, number>;
}

export interface MetricTrend {
  slope: number;
  direction: 'improving' | 'degrading' | 'stable';
}

export interface SuiteRunTrendReport {
  suiteName: string;
  window: number;
  passRateTrend: MetricTrend;
  metricTrends: Record<string, MetricTrend>;
  anyRegression: boolean;
}

export interface TrendAnalyzeOptions {
  window?: number;
  stableThreshold?: number;
}

function olsSlope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

function classify(slope: number, threshold: number): 'improving' | 'degrading' | 'stable' {
  if (Math.abs(slope) < threshold) return 'stable';
  return slope > 0 ? 'improving' : 'degrading';
}

async function resolvePatterns(patterns: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (const pattern of patterns) {
    if (!pattern.includes('*')) {
      paths.push(pattern);
      continue;
    }
    const dir = resolve(dirname(pattern));
    const regexSource = basename(pattern)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexSource}$`);
    const entries = await readdir(dir).catch(() => [] as string[]);
    const matched = entries.filter(f => regex.test(f)).map(f => join(dir, f)).sort();
    paths.push(...matched);
  }
  return paths;
}

export class SuiteRunTrendAnalyzer {
  async analyze(reportPaths: string[], options: TrendAnalyzeOptions = {}): Promise<SuiteRunTrendReport> {
    const { window: windowSize, stableThreshold = 0.005 } = options;

    const resolved = await resolvePatterns(reportPaths);
    if (resolved.length === 0) throw new Error('No report files found matching the provided patterns');

    const reports: TestSuiteReport[] = [];
    for (const p of resolved) {
      const raw = await readFile(p, 'utf-8');
      reports.push(JSON.parse(raw) as TestSuiteReport);
    }

    reports.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const windowed = windowSize ? reports.slice(-windowSize) : reports;

    const suiteName = windowed[0].name;
    const passSlope = olsSlope(windowed.map(r => r.passRate));

    const metricNames = new Set<string>();
    for (const r of windowed) {
      for (const name of Object.keys(r.summary.metrics)) metricNames.add(name);
    }

    const metricTrends: Record<string, MetricTrend> = {};
    for (const name of metricNames) {
      const values = windowed
        .map(r => r.summary.metrics[name]?.average)
        .filter((v): v is number => v !== undefined && !isNaN(v));
      if (values.length < 2) continue;
      const slope = olsSlope(values);
      metricTrends[name] = { slope, direction: classify(slope, stableThreshold) };
    }

    const passRateTrend: MetricTrend = { slope: passSlope, direction: classify(passSlope, stableThreshold) };
    const anyRegression =
      passRateTrend.direction === 'degrading' ||
      Object.values(metricTrends).some(t => t.direction === 'degrading');

    return { suiteName, window: windowed.length, passRateTrend, metricTrends, anyRegression };
  }
}
