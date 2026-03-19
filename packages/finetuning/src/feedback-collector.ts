/**
 * Feedback Collector
 * 
 * Collects user feedback and converts it to fine-tuning datasets.
 */

// No external dependencies needed for this module
import type {
  FeedbackEntry,
  FeedbackCollectorConfig,
  DatasetEntry,
} from './types.js';

export class FeedbackCollector {
  private config: FeedbackCollectorConfig;
  private entries: FeedbackEntry[] = [];

  constructor(config: FeedbackCollectorConfig = {}) {
    this.config = {
      minSamples: 10,
      autoConvert: false,
      filterLowRatings: true,
      ratingThreshold: 3,
      ...config,
    };
  }

  add(entry: Omit<FeedbackEntry, 'timestamp'>): void {
    this.entries.push({ ...entry, timestamp: new Date() });
  }

  addBatch(entries: Omit<FeedbackEntry, 'timestamp'>[]): void {
    entries.forEach(e => this.add(e));
  }

  getEntries(): FeedbackEntry[] {
    return [...this.entries];
  }

  getFilteredEntries(): FeedbackEntry[] {
    if (!this.config.filterLowRatings) return this.entries;
    return this.entries.filter(e => !e.rating || e.rating >= (this.config.ratingThreshold || 3));
  }

  clear(): void {
    this.entries = [];
  }

  toDataset(): DatasetEntry[] {
    const filtered = this.getFilteredEntries();
    return filtered.map(entry => ({
      messages: [
        { role: 'user' as const, content: entry.input },
        { role: 'assistant' as const, content: entry.expectedOutput || entry.output },
      ],
    }));
  }

  toJSONL(): string {
    return this.toDataset().map(e => JSON.stringify(e)).join('\n');
  }

  async saveToFile(filePath: string): Promise<void> {
    const fs = await import('fs');
    fs.writeFileSync(filePath, this.toJSONL());
  }

  getStats(): { total: number; filtered: number; avgRating: number | null } {
    const filtered = this.getFilteredEntries();
    const ratings = this.entries.filter(e => e.rating !== undefined).map(e => e.rating!);
    return {
      total: this.entries.length,
      filtered: filtered.length,
      avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    };
  }

  isReadyForTraining(): boolean {
    return this.getFilteredEntries().length >= (this.config.minSamples || 10);
  }
}

export function createFeedbackCollector(config?: FeedbackCollectorConfig): FeedbackCollector {
  return new FeedbackCollector(config);
}
