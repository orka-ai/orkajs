# @orka-js/finetuning

Fine-tuning orchestration for OrkaJS. Provides dataset validation, API orchestration, model versioning, and feedback collection.

## Installation

```bash
npm install @orka-js/finetuning
# or
pnpm add @orka-js/finetuning
```

## Features

- 📊 **Dataset Validation** - Validate JSONL datasets before training
- 🚀 **Multi-Provider Support** - OpenAI, Anthropic, Mistral, Together, Anyscale
- 💰 **Cost Estimation** - Estimate training costs before starting
- 📈 **Job Monitoring** - Track training progress and metrics
- 🔄 **Model Versioning** - Track fine-tuned model versions
- 📝 **Feedback Collection** - Collect user feedback and convert to datasets

## Quick Start

### Dataset Validation

```typescript
import { DatasetValidator } from '@orka-js/finetuning';

const validator = new DatasetValidator('openai');
const result = await validator.validateFile('./training.jsonl');

if (result.valid) {
  console.log('Dataset is valid!');
  console.log('Stats:', result.stats);
} else {
  console.log('Errors:', result.errors);
}
```

### Fine-tuning Orchestration

```typescript
import { FineTuningOrchestrator } from '@orka-js/finetuning';

const orchestrator = new FineTuningOrchestrator({
  provider: 'openai',
  baseModel: 'gpt-4o-mini-2024-07-18',
  apiKey: process.env.OPENAI_API_KEY,
  hyperparameters: {
    nEpochs: 3,
    batchSize: 4,
  },
});

// Create a fine-tuning job
const job = await orchestrator.createJob('./training.jsonl', {
  validationPath: './validation.jsonl',
});

console.log('Job created:', job.id);

// Monitor progress
orchestrator.on((event) => {
  if (event.type === 'metrics') {
    console.log('Training loss:', event.metrics?.trainingLoss);
  }
});

// Wait for completion
const completed = await orchestrator.waitForCompletion(job.id);
console.log('Fine-tuned model:', completed.fineTunedModel);
```

### Cost Estimation

```typescript
const estimate = orchestrator.estimateCost(100000, 3); // 100k tokens, 3 epochs
console.log(`Estimated cost: $${estimate.trainingCost.toFixed(2)}`);
```

### Feedback Collection

```typescript
import { FeedbackCollector } from '@orka-js/finetuning';

const collector = new FeedbackCollector({
  minSamples: 50,
  filterLowRatings: true,
  ratingThreshold: 4,
});

// Collect feedback from your application
collector.add({
  input: 'What is the capital of France?',
  output: 'The capital of France is Paris.',
  rating: 5,
});

collector.add({
  input: 'Explain quantum computing',
  output: 'Quantum computing uses qubits...',
  expectedOutput: 'Quantum computing is a type of computation...',
  rating: 3,
  feedback: 'Could be more detailed',
});

// Check if ready for training
if (collector.isReadyForTraining()) {
  // Convert to dataset
  const dataset = collector.toDataset();
  
  // Or save directly
  await collector.saveToFile('./feedback-dataset.jsonl');
}
```

## Dataset Format

The expected JSONL format for fine-tuning:

```jsonl
{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi! How can I help?"}]}
{"messages": [{"role": "user", "content": "What is 2+2?"}, {"role": "assistant", "content": "2+2 equals 4."}]}
```

## Supported Providers

| Provider | Status | Notes |
|----------|--------|-------|
| OpenAI | ✅ Full support | GPT-4o-mini, GPT-3.5-turbo |
| Mistral | ✅ Full support | Mistral models |
| Anthropic | 🔄 Beta | Limited access |
| Together | 🔄 Planned | Coming soon |
| Anyscale | 🔄 Planned | Coming soon |

## API Reference

### DatasetValidator

| Method | Description |
|--------|-------------|
| `validateFile(path)` | Validate a JSONL file |
| `validateEntries(entries)` | Validate an array of entries |

### FineTuningOrchestrator

| Method | Description |
|--------|-------------|
| `createJob(datasetPath, options?)` | Create a fine-tuning job |
| `createJobFromEntries(entries, options?)` | Create job from array |
| `getJob(jobId)` | Get job status |
| `listJobs()` | List all jobs |
| `cancelJob(jobId)` | Cancel a job |
| `waitForCompletion(jobId, pollInterval?)` | Wait for job completion |
| `estimateCost(tokens, epochs?)` | Estimate training cost |
| `getModelVersions()` | Get all model versions |
| `getLatestVersion()` | Get latest model version |

### FeedbackCollector

| Method | Description |
|--------|-------------|
| `add(entry)` | Add a feedback entry |
| `addBatch(entries)` | Add multiple entries |
| `getEntries()` | Get all entries |
| `getFilteredEntries()` | Get filtered entries |
| `toDataset()` | Convert to dataset format |
| `toJSONL()` | Convert to JSONL string |
| `saveToFile(path)` | Save to file |
| `isReadyForTraining()` | Check if enough samples |

## License

MIT
