/**
 * @orka-js/finetuning
 * 
 * Fine-tuning orchestration for OrkaJS.
 * Provides dataset validation, API orchestration, and model versioning.
 * 
 * @example
 * ```typescript
 * import { FineTuningOrchestrator, FeedbackCollector } from '@orka-js/finetuning';
 * 
 * // Create orchestrator
 * const orchestrator = new FineTuningOrchestrator({
 *   provider: 'openai',
 *   baseModel: 'gpt-4o-mini-2024-07-18',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 * 
 * // Create job from dataset file
 * const job = await orchestrator.createJob('./training.jsonl');
 * 
 * // Wait for completion
 * const completed = await orchestrator.waitForCompletion(job.id);
 * console.log('Fine-tuned model:', completed.fineTunedModel);
 * ```
 */

// Types
export type {
  FineTuningProvider,
  FineTuningConfig,
  HyperParameters,
  DatasetEntry,
  DatasetMessage,
  DatasetToolCall,
  DatasetValidationResult,
  DatasetError,
  DatasetWarning,
  DatasetStats,
  FineTuningJob,
  FineTuningStatus,
  FineTuningMetrics,
  FineTuningEvent,
  ModelVersion,
  FeedbackEntry,
  FeedbackCollectorConfig,
  CostEstimate,
  FineTuningEventListener,
} from './types.js';

// Dataset Validator
export { DatasetValidator, createDatasetValidator } from './dataset-validator.js';

// Fine-tuning Orchestrator
export { FineTuningOrchestrator, createFineTuningOrchestrator } from './finetuning-orchestrator.js';

// Feedback Collector
export { FeedbackCollector, createFeedbackCollector } from './feedback-collector.js';
