/**
 * Fine-tuning Orchestrator
 * 
 * Orchestrates fine-tuning jobs across different providers.
 */

import { generateId, OrkaError, OrkaErrorCode } from '@orka-js/core';
import { DatasetValidator } from './dataset-validator.js';
import type {
  FineTuningConfig,
  FineTuningJob,
  FineTuningStatus,
  FineTuningEvent,
  FineTuningEventListener,
  ModelVersion,
  CostEstimate,
  DatasetEntry,
} from './types.js';

export class FineTuningOrchestrator {
  private config: FineTuningConfig;
  private jobs: Map<string, FineTuningJob> = new Map();
  private versions: Map<string, ModelVersion> = new Map();
  private eventListeners: Set<FineTuningEventListener> = new Set();
  private validator: DatasetValidator;

  constructor(config: FineTuningConfig) {
    this.config = config;
    this.validator = new DatasetValidator(config.provider);
  }

  async createJob(datasetPath: string, options?: { validationPath?: string }): Promise<FineTuningJob> {
    // Validate dataset
    const validation = await this.validator.validateFile(datasetPath);
    if (!validation.valid) {
      throw new OrkaError(
        `Dataset validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        OrkaErrorCode.INVALID_INPUT,
        'finetuning'
      );
    }

    this.emit({ type: 'message', timestamp: new Date(), message: `Dataset validated: ${validation.stats.totalExamples} examples, ${validation.stats.totalTokens} tokens` });

    // Upload dataset and create job based on provider
    const job = await this.createProviderJob(datasetPath, options?.validationPath);
    this.jobs.set(job.id, job);

    this.emit({ type: 'message', timestamp: new Date(), message: `Fine-tuning job created: ${job.id}` });

    return job;
  }

  async createJobFromEntries(entries: DatasetEntry[], options?: { validationEntries?: DatasetEntry[] }): Promise<FineTuningJob> {
    const validation = this.validator.validateEntries(entries);
    if (!validation.valid) {
      throw new OrkaError(
        `Dataset validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        OrkaErrorCode.INVALID_INPUT,
        'finetuning'
      );
    }

    // Convert to JSONL and upload
    const jsonl = entries.map(e => JSON.stringify(e)).join('\n');
    const job = await this.uploadAndCreateJob(jsonl, options?.validationEntries);
    this.jobs.set(job.id, job);

    return job;
  }

  async getJob(jobId: string): Promise<FineTuningJob | undefined> {
    const cached = this.jobs.get(jobId);
    if (cached && !this.isTerminalStatus(cached.status)) {
      const updated = await this.fetchJobStatus(jobId);
      this.jobs.set(jobId, updated);
      return updated;
    }
    return cached;
  }

  async listJobs(): Promise<FineTuningJob[]> {
    return Array.from(this.jobs.values());
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new OrkaError(`Job not found: ${jobId}`, OrkaErrorCode.NOT_FOUND, 'finetuning');

    await this.cancelProviderJob(jobId);
    job.status = 'cancelled';
    job.updatedAt = new Date();
    this.jobs.set(jobId, job);

    this.emit({ type: 'message', timestamp: new Date(), message: `Job cancelled: ${jobId}` });
  }

  async waitForCompletion(jobId: string, pollIntervalMs = 30000): Promise<FineTuningJob> {
    let job = await this.getJob(jobId);
    if (!job) throw new OrkaError(`Job not found: ${jobId}`, OrkaErrorCode.NOT_FOUND, 'finetuning');

    while (!this.isTerminalStatus(job.status)) {
      await this.sleep(pollIntervalMs);
      job = await this.getJob(jobId);
      if (!job) throw new OrkaError(`Job not found: ${jobId}`, OrkaErrorCode.NOT_FOUND, 'finetuning');

      if (job.metrics) {
        this.emit({ type: 'metrics', timestamp: new Date(), metrics: job.metrics });
      }
    }

    if (job.status === 'succeeded' && job.fineTunedModel) {
      const version = this.createModelVersion(job);
      this.versions.set(version.id, version);
      this.emit({ type: 'message', timestamp: new Date(), message: `Model ready: ${job.fineTunedModel}` });
    }

    return job;
  }

  estimateCost(tokenCount: number, epochs?: number): CostEstimate {
    const nEpochs = epochs || this.config.hyperparameters?.nEpochs || 3;
    const pricePerToken: Record<string, number> = {
      openai: 0.000008,
      anthropic: 0.000015,
      mistral: 0.000004,
      together: 0.000003,
      anyscale: 0.000005,
    };

    const price = pricePerToken[this.config.provider] || 0.000008;
    const totalTokens = tokenCount * nEpochs;

    return {
      trainingCost: totalTokens * price,
      currency: 'USD',
      tokensUsed: totalTokens,
      pricePerToken: price,
      epochs: nEpochs,
    };
  }

  getModelVersions(): ModelVersion[] {
    return Array.from(this.versions.values());
  }

  getLatestVersion(): ModelVersion | undefined {
    const versions = this.getModelVersions();
    return versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  on(listener: FineTuningEventListener): void {
    this.eventListeners.add(listener);
  }

  off(listener: FineTuningEventListener): void {
    this.eventListeners.delete(listener);
  }

  private emit(event: FineTuningEvent): void {
    this.eventListeners.forEach(l => { try { l(event); } catch {} });
  }

  private async createProviderJob(datasetPath: string, validationPath?: string): Promise<FineTuningJob> {
    switch (this.config.provider) {
      case 'openai':
        return this.createOpenAIJob(datasetPath, validationPath);
      case 'anthropic':
        return this.createAnthropicJob(datasetPath);
      case 'mistral':
        return this.createMistralJob(datasetPath, validationPath);
      default:
        return this.createGenericJob(datasetPath);
    }
  }

  private async createOpenAIJob(datasetPath: string, validationPath?: string): Promise<FineTuningJob> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new OrkaError('OpenAI API key required', OrkaErrorCode.INVALID_CONFIG, 'finetuning');

    // Upload training file
    const trainingFileId = await this.uploadOpenAIFile(datasetPath, apiKey);
    let validationFileId: string | undefined;
    if (validationPath) {
      validationFileId = await this.uploadOpenAIFile(validationPath, apiKey);
    }

    // Create fine-tuning job
    const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        training_file: trainingFileId,
        validation_file: validationFileId,
        model: this.config.baseModel,
        suffix: this.config.suffix,
        hyperparameters: this.config.hyperparameters ? {
          n_epochs: this.config.hyperparameters.nEpochs,
          batch_size: this.config.hyperparameters.batchSize,
          learning_rate_multiplier: this.config.hyperparameters.learningRateMultiplier,
        } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new OrkaError(`OpenAI error: ${error.error?.message || response.statusText}`, OrkaErrorCode.EXTERNAL_SERVICE_ERROR, 'finetuning');
    }

    const data = await response.json();
    return this.mapOpenAIJob(data);
  }

  private async uploadOpenAIFile(filePath: string, apiKey: string): Promise<string> {
    const fs = await import('fs');
    const FormData = (await import('form-data')).default;

    const form = new FormData();
    form.append('purpose', 'fine-tune');
    form.append('file', fs.createReadStream(filePath));

    const response = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form as unknown as BodyInit,
    });

    if (!response.ok) throw new OrkaError('Failed to upload file to OpenAI', OrkaErrorCode.EXTERNAL_SERVICE_ERROR, 'finetuning');

    const data = await response.json();
    return data.id;
  }

  private mapOpenAIJob(data: Record<string, unknown>): FineTuningJob {
    return {
      id: data.id as string,
      provider: 'openai',
      status: this.mapOpenAIStatus(data.status as string),
      baseModel: data.model as string,
      fineTunedModel: data.fine_tuned_model as string | undefined,
      createdAt: new Date((data.created_at as number) * 1000),
      updatedAt: new Date(),
      trainingFile: data.training_file as string,
      validationFile: data.validation_file as string | undefined,
      hyperparameters: {
        nEpochs: (data.hyperparameters as Record<string, unknown>)?.n_epochs as number,
      },
      trainedTokens: data.trained_tokens as number | undefined,
      error: (data.error as Record<string, unknown>)?.message as string | undefined,
    };
  }

  private mapOpenAIStatus(status: string): FineTuningStatus {
    const map: Record<string, FineTuningStatus> = {
      validating_files: 'validating_files',
      queued: 'queued',
      running: 'running',
      succeeded: 'succeeded',
      failed: 'failed',
      cancelled: 'cancelled',
    };
    return map[status] || 'queued';
  }

  private async createAnthropicJob(datasetPath: string): Promise<FineTuningJob> {
    // Anthropic fine-tuning is currently in beta/limited access
    // This is a placeholder implementation
    return {
      id: generateId(),
      provider: 'anthropic',
      status: 'queued',
      baseModel: this.config.baseModel,
      createdAt: new Date(),
      updatedAt: new Date(),
      trainingFile: datasetPath,
      hyperparameters: this.config.hyperparameters || {},
    };
  }

  private async createMistralJob(datasetPath: string, validationPath?: string): Promise<FineTuningJob> {
    const apiKey = this.config.apiKey || process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new OrkaError('Mistral API key required', OrkaErrorCode.INVALID_CONFIG, 'finetuning');

    // Mistral fine-tuning API
    const response = await fetch('https://api.mistral.ai/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.baseModel,
        training_files: [{ file_id: datasetPath }],
        validation_files: validationPath ? [{ file_id: validationPath }] : undefined,
        hyperparameters: this.config.hyperparameters,
      }),
    });

    if (!response.ok) {
      throw new OrkaError(`Mistral error: ${response.statusText}`, OrkaErrorCode.EXTERNAL_SERVICE_ERROR, 'finetuning');
    }

    const data = await response.json();
    return {
      id: data.id,
      provider: 'mistral',
      status: data.status as FineTuningStatus,
      baseModel: this.config.baseModel,
      fineTunedModel: data.fine_tuned_model,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(),
      trainingFile: datasetPath,
      hyperparameters: this.config.hyperparameters || {},
    };
  }

  private async createGenericJob(datasetPath: string): Promise<FineTuningJob> {
    return {
      id: generateId(),
      provider: this.config.provider,
      status: 'queued',
      baseModel: this.config.baseModel,
      createdAt: new Date(),
      updatedAt: new Date(),
      trainingFile: datasetPath,
      hyperparameters: this.config.hyperparameters || {},
    };
  }

  private async uploadAndCreateJob(jsonl: string, validationEntries?: DatasetEntry[]): Promise<FineTuningJob> {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const tempDir = os.tmpdir();
    const trainingPath = path.join(tempDir, `orka-finetune-${generateId()}.jsonl`);
    fs.writeFileSync(trainingPath, jsonl);

    let validationPath: string | undefined;
    if (validationEntries) {
      validationPath = path.join(tempDir, `orka-finetune-val-${generateId()}.jsonl`);
      fs.writeFileSync(validationPath, validationEntries.map(e => JSON.stringify(e)).join('\n'));
    }

    return this.createProviderJob(trainingPath, validationPath);
  }

  private async fetchJobStatus(jobId: string): Promise<FineTuningJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new OrkaError(`Job not found: ${jobId}`, OrkaErrorCode.NOT_FOUND, 'finetuning');

    if (job.provider === 'openai') {
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (response.ok) {
        const data = await response.json();
        return this.mapOpenAIJob(data);
      }
    }

    return job;
  }

  private async cancelProviderJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (job.provider === 'openai') {
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
    }
  }

  private createModelVersion(job: FineTuningJob): ModelVersion {
    return {
      id: generateId(),
      name: `${this.config.baseModel}-ft-${new Date().toISOString().slice(0, 10)}`,
      baseModel: job.baseModel,
      fineTunedModel: job.fineTunedModel!,
      createdAt: new Date(),
      jobId: job.id,
      metrics: job.metrics,
    };
  }

  private isTerminalStatus(status: FineTuningStatus): boolean {
    return ['succeeded', 'failed', 'cancelled'].includes(status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createFineTuningOrchestrator(config: FineTuningConfig): FineTuningOrchestrator {
  return new FineTuningOrchestrator(config);
}
