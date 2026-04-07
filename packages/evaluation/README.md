# @orka-js/evaluation

Evaluation framework for RAG pipelines and agents — built-in LLM-judge metrics, RAGAS-compatible metrics, test suites, assertions, reporters, and trend analysis.

## Installation

```bash
npm install @orka-js/evaluation
```

## Quick Start

```typescript
import { Evaluator, builtinMetrics } from '@orka-js/evaluation';

// orka is any object with .ask() and .getLLM()
const evaluator = new Evaluator(orka, llm);

const summary = await evaluator.evaluate({
  dataset: [
    {
      input: 'What is OrkaJS?',
      expectedOutput: 'OrkaJS is an AI agent framework for TypeScript.',
    },
    {
      input: 'How do I install OrkaJS?',
      expectedOutput: 'Run npm install orkajs.',
    },
  ],
  metrics: ['relevance', 'faithfulness', 'correctness'],
  concurrency: 2,
  onResult: (result, i) => console.log(`[${i}] score:`, result.metrics),
});

console.log(summary.metrics.relevance.average);   // e.g. 0.91
console.log(summary.totalCases);                  // 2
```

## API

### `Evaluator`

Runs a dataset through your OrkaJS pipeline and scores each output with a set of metrics.

```typescript
import { Evaluator } from '@orka-js/evaluation';

const evaluator = new Evaluator(orka, llm);
// orka must implement: .ask({ question, knowledge?, includeContext? }) and .getLLM()
// llm is an LLMAdapter used as the evaluation judge
```

**`.evaluate(options): Promise<EvalSummary>`**

```typescript
const summary = await evaluator.evaluate({
  dataset: EvalCase[],           // required
  metrics?: (string | MetricFn)[],  // default ['relevance', 'faithfulness']
  concurrency?: number,          // default 1
  onResult?: (result, index) => void,
});
```

**`EvalSummary`** contains:
- `totalCases` — number of test cases run
- `averageLatencyMs` — mean latency
- `totalTokens` — total tokens used across all cases
- `metrics` — per-metric `{ average, min, max }` object
- `results` — full `EvalResult[]` array

---

### `TestRunner`

Structured test suite runner with pass/fail assertions and pluggable reporters.

```typescript
import { TestRunner } from '@orka-js/evaluation';

const runner = new TestRunner(orka);

const report = await runner.run({
  name: 'FAQ Quality Suite',
  dataset: [
    { input: 'What is OrkaJS?', expectedOutput: 'An AI agent framework.' },
  ],
  metrics: ['relevance', 'faithfulness'],
  assertions: [
    scoreAbove('relevance', 0.7),
    latencyBelow(3000),
  ],
  reporters: [new ConsoleReporter()],
  concurrency: 2,
  bail: false,  // stop on first failure if true
});

console.log(report.passRate);  // 0.0 – 1.0
```

**`TestSuiteReport`** contains: `name`, `timestamp`, `duration`, `totalCases`, `passed`, `failed`, `passRate`, `cases`, and `summary`.

---

### Built-in Metrics (`builtinMetrics`)

All built-in metrics use an LLM as judge and return a score between `0.0` and `1.0`.

| Name | Description |
|---|---|
| `'relevance'` | How relevant is the answer to the question? |
| `'faithfulness'` | Is the answer grounded in the retrieved context? |
| `'correctness'` | How close is the answer to the expected output? |
| `'hallucination'` | How much does the answer hallucinate beyond the context? |
| `'cost'` | Token usage (score = total tokens, not LLM-judged) |

```typescript
import { builtinMetrics } from '@orka-js/evaluation';

// Use by name in Evaluator / TestRunner
metrics: ['relevance', 'faithfulness']

// Or call directly
const result = await builtinMetrics.relevance({ input, output, llm });
// result → { name: 'relevance', score: 0.87 }
```

---

### RAGAS Metrics

RAGAS-style metrics for retrieval-augmented generation evaluation.

```typescript
import {
  ragasMetrics,
  contextPrecision,
  contextRecall,
  answerRelevance,
  semanticSimilarity,
  cosineSimilarity,
} from '@orka-js/evaluation';
```

| Export | Method | Description |
|---|---|---|
| `contextPrecision` | LLM judge | What fraction of retrieved contexts are relevant? |
| `contextRecall` | LLM judge | Does the context cover all aspects of the expected answer? |
| `answerRelevance` | Cosine similarity | Is the answer semantically close to the question? |
| `semanticSimilarity` | Cosine similarity | Is the answer semantically close to the expected answer? |
| `cosineSimilarity` | Pure function | `(a: number[], b: number[]) => number` — cosine of two embedding vectors |
| `ragasMetrics` | — | Object containing all four metric functions |

```typescript
import { contextPrecision } from '@orka-js/evaluation';

const result = await contextPrecision({
  input: 'What is OrkaJS?',
  output: 'An AI agent framework.',
  context: ['OrkaJS is a TypeScript framework for building AI agents.'],
  llm,
});
// result → { name: 'context_precision', score: 0.95 }
```

---

### Custom Metrics

A metric is any async function matching `MetricFn`:

```typescript
import type { MetricFn } from '@orka-js/evaluation';

const myMetric: MetricFn = async ({ input, output, expectedOutput, context, llm }) => {
  // compute score 0.0 – 1.0
  return { name: 'my_metric', score: 0.85, details: { reason: '...' } };
};

// Use it directly in Evaluator
metrics: ['relevance', myMetric]
```

---

### Assertions

Assertions define pass/fail conditions on top of metric scores.

```typescript
import { scoreAbove, scoreBelow, latencyBelow, tokensBudget } from '@orka-js/evaluation';

assertions: [
  scoreAbove('relevance', 0.7),    // fail if relevance < 0.7
  scoreBelow('hallucination', 0.2), // fail if hallucination > 0.2
  latencyBelow(3000),               // fail if latencyMs > 3000
  tokensBudget(1000),               // fail if totalTokens > 1000
]
```

---

### Reporters

| Class | Description |
|---|---|
| `ConsoleReporter` | Prints a formatted table to stdout (default) |
| `JSONReporter` | Writes results to a JSON file |

```typescript
import { JSONReporter } from '@orka-js/evaluation';

reporters: [new JSONReporter({ path: './eval-results.json' })]
```

---

### `SuiteRunTrendAnalyzer`

Compare evaluation results across multiple runs to detect regressions or improvements.

```typescript
import { SuiteRunTrendAnalyzer } from '@orka-js/evaluation';

const analyzer = new SuiteRunTrendAnalyzer();

analyzer.addRun(report1);
analyzer.addRun(report2);
analyzer.addRun(report3);

const trend = analyzer.analyze({ metric: 'relevance' });
// trend.direction → 'improving' | 'degrading' | 'stable'
// trend.delta → change from first to last run
```

---

## Types

```typescript
import type {
  EvalCase,
  EvalResult,
  EvalSummary,
  MetricFn,
  MetricResult,
} from '@orka-js/evaluation';
```

**`EvalCase`**

```typescript
interface EvalCase {
  input: string;
  expectedOutput?: string;
  knowledge?: string;
  context?: string[];
  metadata?: Record<string, unknown>;
}
```

**`EvalResult`**

```typescript
interface EvalResult {
  input: string;
  output: string;
  expectedOutput?: string;
  metrics: MetricResult[];   // [{ name, score, details? }]
  latencyMs: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}
```

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter`
- [`@orka-js/tools`](../tools) — RAG chains to evaluate
- [`@orka-js/test`](../test) — Unit testing utilities for agents
- [`orkajs`](../orkajs) — Full OrkaJS bundle
