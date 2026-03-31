---
"@orka-js/evaluation": minor
---

feat(evaluation): RAGAS metrics suite

Add four production-grade RAGAS evaluation metrics:
- `contextPrecision` — LLM judge: fraction of retrieved contexts that are useful
- `contextRecall` — LLM judge: how well context covers the expected answer
- `answerRelevance` — embedding cosine similarity between question and answer
- `semanticSimilarity` — embedding cosine similarity between output and expected output

Also exports `cosineSimilarity()` helper and `ragasMetrics` bundle.
All metrics follow the existing `MetricFn` interface.
