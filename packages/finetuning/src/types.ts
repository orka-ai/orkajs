/**
 * Fine-tuning Orchestration Types
 */

export type FineTuningProvider = 'openai' | 'anthropic' | 'mistral' | 'together' | 'anyscale';

export interface FineTuningConfig {
  provider: FineTuningProvider;
  apiKey?: string;
  baseModel: string;
  suffix?: string;
  hyperparameters?: HyperParameters;
  validationSplit?: number;
  verbose?: boolean;
}

export interface HyperParameters {
  nEpochs?: number;
  batchSize?: number;
  learningRateMultiplier?: number;
}

export interface DatasetEntry {
  messages: DatasetMessage[];
  weight?: number;
}

export interface DatasetMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
  toolCalls?: DatasetToolCall[];
  toolCallId?: string;
}

export interface DatasetToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface DatasetValidationResult {
  valid: boolean;
  errors: DatasetError[];
  warnings: DatasetWarning[];
  stats: DatasetStats;
}

export interface DatasetError {
  line: number;
  message: string;
  field?: string;
}

export interface DatasetWarning {
  line: number;
  message: string;
  suggestion?: string;
}

export interface DatasetStats {
  totalExamples: number;
  totalTokens: number;
  avgTokensPerExample: number;
  maxTokens: number;
  minTokens: number;
  roleDistribution: Record<string, number>;
  estimatedCost?: number;
}

export interface FineTuningJob {
  id: string;
  provider: FineTuningProvider;
  status: FineTuningStatus;
  baseModel: string;
  fineTunedModel?: string;
  createdAt: Date;
  updatedAt: Date;
  trainingFile: string;
  validationFile?: string;
  hyperparameters: HyperParameters;
  trainedTokens?: number;
  error?: string;
  metrics?: FineTuningMetrics;
}

export type FineTuningStatus = 
  | 'validating_files'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface FineTuningMetrics {
  trainingLoss?: number;
  validationLoss?: number;
  fullValidationLoss?: number;
  step?: number;
  epoch?: number;
}

export interface FineTuningEvent {
  type: 'message' | 'metrics' | 'checkpoint';
  timestamp: Date;
  message?: string;
  metrics?: FineTuningMetrics;
  checkpoint?: string;
}

export interface ModelVersion {
  id: string;
  name: string;
  baseModel: string;
  fineTunedModel: string;
  createdAt: Date;
  jobId: string;
  metrics?: FineTuningMetrics;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface FeedbackEntry {
  input: string;
  output: string;
  expectedOutput?: string;
  rating?: number;
  feedback?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface FeedbackCollectorConfig {
  minSamples?: number;
  autoConvert?: boolean;
  filterLowRatings?: boolean;
  ratingThreshold?: number;
}

export interface CostEstimate {
  trainingCost: number;
  currency: string;
  tokensUsed: number;
  pricePerToken: number;
  epochs: number;
}

export type FineTuningEventListener = (event: FineTuningEvent) => void;
