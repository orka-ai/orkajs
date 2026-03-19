/**
 * Dataset Validator
 * 
 * Validates JSONL datasets for fine-tuning compatibility.
 */

import { OrkaError, OrkaErrorCode } from '@orka-js/core';
import type {
  DatasetEntry,
  DatasetValidationResult,
  DatasetError,
  DatasetWarning,
  DatasetStats,
  FineTuningProvider,
} from './types.js';

const PROVIDER_LIMITS: Record<FineTuningProvider, { maxTokens: number; maxExamples: number }> = {
  openai: { maxTokens: 16385, maxExamples: 100000 },
  anthropic: { maxTokens: 100000, maxExamples: 10000 },
  mistral: { maxTokens: 32768, maxExamples: 100000 },
  together: { maxTokens: 8192, maxExamples: 100000 },
  anyscale: { maxTokens: 8192, maxExamples: 100000 },
};

export class DatasetValidator {
  private provider: FineTuningProvider;

  constructor(provider: FineTuningProvider = 'openai') {
    this.provider = provider;
  }

  async validateFile(filePath: string): Promise<DatasetValidationResult> {
    const fs = await import('fs');
    const readline = await import('readline');

    if (!fs.existsSync(filePath)) {
      throw new OrkaError(`File not found: ${filePath}`, OrkaErrorCode.NOT_FOUND, 'finetuning');
    }

    const errors: DatasetError[] = [];
    const warnings: DatasetWarning[] = [];
    const entries: DatasetEntry[] = [];
    let lineNumber = 0;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      lineNumber++;
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as DatasetEntry;
        const entryErrors = this.validateEntry(entry, lineNumber);
        errors.push(...entryErrors);
        
        if (entryErrors.length === 0) {
          entries.push(entry);
        }
      } catch {
        errors.push({ line: lineNumber, message: 'Invalid JSON' });
      }
    }

    const stats = this.calculateStats(entries);
    const structuralWarnings = this.checkStructuralIssues(entries, stats);
    warnings.push(...structuralWarnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    };
  }

  validateEntries(entries: DatasetEntry[]): DatasetValidationResult {
    const errors: DatasetError[] = [];
    const warnings: DatasetWarning[] = [];

    entries.forEach((entry, index) => {
      const entryErrors = this.validateEntry(entry, index + 1);
      errors.push(...entryErrors);
    });

    const validEntries = entries.filter((_, i) => !errors.some(e => e.line === i + 1));
    const stats = this.calculateStats(validEntries);
    const structuralWarnings = this.checkStructuralIssues(validEntries, stats);
    warnings.push(...structuralWarnings);

    return { valid: errors.length === 0, errors, warnings, stats };
  }

  private validateEntry(entry: DatasetEntry, line: number): DatasetError[] {
    const errors: DatasetError[] = [];

    if (!entry.messages || !Array.isArray(entry.messages)) {
      errors.push({ line, message: 'Missing or invalid "messages" array', field: 'messages' });
      return errors;
    }

    if (entry.messages.length < 2) {
      errors.push({ line, message: 'At least 2 messages required (user + assistant)', field: 'messages' });
    }

    const hasUser = entry.messages.some(m => m.role === 'user');
    const hasAssistant = entry.messages.some(m => m.role === 'assistant');

    if (!hasUser) {
      errors.push({ line, message: 'Missing user message', field: 'messages' });
    }
    if (!hasAssistant) {
      errors.push({ line, message: 'Missing assistant message', field: 'messages' });
    }

    entry.messages.forEach((msg, i) => {
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        errors.push({ line, message: `Invalid role "${msg.role}" at message ${i}`, field: `messages[${i}].role` });
      }
      if (typeof msg.content !== 'string' || msg.content.trim() === '') {
        errors.push({ line, message: `Empty or invalid content at message ${i}`, field: `messages[${i}].content` });
      }
    });

    return errors;
  }

  private checkStructuralIssues(entries: DatasetEntry[], stats: DatasetStats): DatasetWarning[] {
    const warnings: DatasetWarning[] = [];
    const limits = PROVIDER_LIMITS[this.provider];

    if (entries.length < 10) {
      warnings.push({ line: 0, message: `Only ${entries.length} examples. Recommend at least 10 for basic fine-tuning.`, suggestion: 'Add more training examples' });
    }

    if (stats.maxTokens > limits.maxTokens) {
      warnings.push({ line: 0, message: `Some examples exceed ${limits.maxTokens} token limit for ${this.provider}`, suggestion: 'Truncate or split long examples' });
    }

    if (entries.length > limits.maxExamples) {
      warnings.push({ line: 0, message: `Dataset exceeds ${limits.maxExamples} example limit for ${this.provider}`, suggestion: 'Split into multiple datasets' });
    }

    const systemMessages = entries.filter(e => e.messages.some(m => m.role === 'system'));
    if (systemMessages.length > 0 && systemMessages.length < entries.length) {
      warnings.push({ line: 0, message: 'Inconsistent system message usage', suggestion: 'Use system messages consistently across all examples' });
    }

    return warnings;
  }

  private calculateStats(entries: DatasetEntry[]): DatasetStats {
    const tokenCounts = entries.map(e => this.estimateTokens(e));
    const roleDistribution: Record<string, number> = { system: 0, user: 0, assistant: 0 };

    entries.forEach(e => {
      e.messages.forEach(m => {
        roleDistribution[m.role] = (roleDistribution[m.role] || 0) + 1;
      });
    });

    const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);

    return {
      totalExamples: entries.length,
      totalTokens,
      avgTokensPerExample: entries.length > 0 ? Math.round(totalTokens / entries.length) : 0,
      maxTokens: Math.max(...tokenCounts, 0),
      minTokens: Math.min(...tokenCounts, 0),
      roleDistribution,
      estimatedCost: this.estimateCost(totalTokens),
    };
  }

  private estimateTokens(entry: DatasetEntry): number {
    return entry.messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
  }

  private estimateCost(tokens: number): number {
    const pricePerToken: Record<FineTuningProvider, number> = {
      openai: 0.000008,
      anthropic: 0.000015,
      mistral: 0.000004,
      together: 0.000003,
      anyscale: 0.000005,
    };
    return tokens * (pricePerToken[this.provider] || 0.000008);
  }
}

export function createDatasetValidator(provider?: FineTuningProvider): DatasetValidator {
  return new DatasetValidator(provider);
}
