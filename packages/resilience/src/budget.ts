import type {
  LLMAdapter,
  LLMGenerateOptions,
  LLMResult,
  OrkaSchema,
  StreamingLLMAdapter,
  StreamGenerateOptions,
  StreamResult,
  LLMStreamEvent,
} from '@orka-js/core';
import { isStreamingAdapter } from '@orka-js/core';

export interface BudgetConfig {
  /** Maximum tokens per individual LLM call */
  maxTokensPerCall?: number;
  /** Maximum cost (USD) per individual LLM call */
  maxCostPerCall?: number;
  /** Maximum tokens across ALL calls (lifetime of this instance) */
  maxTotalTokens?: number;
  /** Maximum cost (USD) across ALL calls */
  maxTotalCost?: number;
  /** Maximum tokens per day (resets at midnight UTC) */
  maxDailyTokens?: number;
  /** Maximum cost (USD) per day (resets at midnight UTC) */
  maxDailyCost?: number;
  /** What to do when budget is exceeded — default: 'error' */
  onBudgetExceeded?: 'error' | 'graceful-stop';
  /** Optional warning callback when approaching budget (90% used) */
  onWarning?: (info: BudgetWarning) => void;
}

export interface BudgetWarning {
  type: 'tokens' | 'cost';
  scope: 'per-call' | 'total' | 'daily';
  used: number;
  limit: number;
  percentUsed: number;
}

export interface BudgetState {
  totalTokensUsed: number;
  totalCostUsed: number;
  dailyTokensUsed: number;
  dailyCostUsed: number;
  dailyResetAt: Date;
  callCount: number;
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly reason: string,
    public readonly state: BudgetState,
  ) {
    super(`Budget exceeded: ${reason}`);
    this.name = 'BudgetExceededError';
  }
}

export class BudgetedLLM implements LLMAdapter {
  readonly name: string;
  readonly supportsStreaming: boolean;
  private inner: LLMAdapter;
  private config: BudgetConfig;
  private state: BudgetState;

  constructor(adapter: LLMAdapter, config: BudgetConfig) {
    this.inner = adapter;
    this.name = `budgeted-${adapter.name}`;
    this.config = config;
    this.supportsStreaming = isStreamingAdapter(adapter);
    this.state = {
      totalTokensUsed: 0,
      totalCostUsed: 0,
      dailyTokensUsed: 0,
      dailyCostUsed: 0,
      dailyResetAt: this.nextMidnightUTC(),
      callCount: 0,
    };
  }

  private nextMidnightUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }

  private resetDailyIfNeeded(): void {
    if (Date.now() >= this.state.dailyResetAt.getTime()) {
      this.state.dailyTokensUsed = 0;
      this.state.dailyCostUsed = 0;
      this.state.dailyResetAt = this.nextMidnightUTC();
    }
  }

  private checkPreCallBudget(): void {
    this.resetDailyIfNeeded();

    const { maxTotalTokens, maxTotalCost, maxDailyTokens, maxDailyCost } = this.config;

    if (maxTotalTokens !== undefined && this.state.totalTokensUsed >= maxTotalTokens) {
      this.handleExceeded(`Total token budget exhausted (${this.state.totalTokensUsed}/${maxTotalTokens})`);
    }
    if (maxTotalCost !== undefined && this.state.totalCostUsed >= maxTotalCost) {
      this.handleExceeded(`Total cost budget exhausted ($${this.state.totalCostUsed.toFixed(4)}/$${maxTotalCost})`);
    }
    if (maxDailyTokens !== undefined && this.state.dailyTokensUsed >= maxDailyTokens) {
      this.handleExceeded(`Daily token budget exhausted (${this.state.dailyTokensUsed}/${maxDailyTokens})`);
    }
    if (maxDailyCost !== undefined && this.state.dailyCostUsed >= maxDailyCost) {
      this.handleExceeded(`Daily cost budget exhausted ($${this.state.dailyCostUsed.toFixed(4)}/$${maxDailyCost})`);
    }
  }

  private checkPostCallBudget(result: LLMResult): void {
    const tokens = result.usage.totalTokens;
    const cost = result.cost ?? 0;

    // Check per-call limits
    if (this.config.maxTokensPerCall !== undefined && tokens > this.config.maxTokensPerCall) {
      throw new BudgetExceededError(
        `Call used ${tokens} tokens, exceeding per-call limit of ${this.config.maxTokensPerCall}`,
        this.state,
      );
    }
    if (this.config.maxCostPerCall !== undefined && cost > this.config.maxCostPerCall) {
      throw new BudgetExceededError(
        `Call cost $${cost.toFixed(4)}, exceeding per-call limit of $${this.config.maxCostPerCall}`,
        this.state,
      );
    }

    // Accumulate usage
    this.state.totalTokensUsed += tokens;
    this.state.totalCostUsed += cost;
    this.state.dailyTokensUsed += tokens;
    this.state.dailyCostUsed += cost;
    this.state.callCount++;

    // Emit warnings when approaching total/daily limits after accumulation
    const { maxTotalTokens, maxTotalCost, maxDailyTokens, maxDailyCost } = this.config;

    if (maxTotalTokens !== undefined) {
      this.emitWarningIfNeeded('tokens', 'total', this.state.totalTokensUsed, maxTotalTokens);
    }
    if (maxDailyTokens !== undefined) {
      this.emitWarningIfNeeded('tokens', 'daily', this.state.dailyTokensUsed, maxDailyTokens);
    }
    if (maxTotalCost !== undefined) {
      this.emitWarningIfNeeded('cost', 'total', this.state.totalCostUsed, maxTotalCost);
    }
    if (maxDailyCost !== undefined) {
      this.emitWarningIfNeeded('cost', 'daily', this.state.dailyCostUsed, maxDailyCost);
    }
  }

  private emitWarningIfNeeded(
    type: BudgetWarning['type'],
    scope: BudgetWarning['scope'],
    used: number,
    limit: number,
  ): void {
    if (!this.config.onWarning) return;
    const percentUsed = (used / limit) * 100;
    if (percentUsed >= 90) {
      this.config.onWarning({ type, scope, used, limit, percentUsed });
    }
  }

  private handleExceeded(reason: string): never {
    throw new BudgetExceededError(reason, this.state);
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    this.checkPreCallBudget();
    const result = await this.inner.generate(prompt, options);
    this.checkPostCallBudget(result);
    return result;
  }

  async generateObject<T>(schema: OrkaSchema<T>, prompt: string, options?: LLMGenerateOptions): Promise<T> {
    this.checkPreCallBudget();
    const result = await this.inner.generateObject(schema, prompt, options);
    // Can't easily get token usage from generateObject, so just track call count
    this.state.callCount++;
    return result;
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    this.resetDailyIfNeeded();
    return this.inner.embed(texts);
  }

  // Streaming support — delegate to inner if available

  stream(prompt: string, options?: StreamGenerateOptions): AsyncIterable<LLMStreamEvent> {
    if (!isStreamingAdapter(this.inner)) {
      throw new Error(`BudgetedLLM: inner adapter "${this.inner.name}" does not support streaming`);
    }
    this.checkPreCallBudget();
    const streamingInner = this.inner as LLMAdapter & StreamingLLMAdapter;
    return this.wrapStream(streamingInner.stream(prompt, options));
  }

  private async *wrapStream(source: AsyncIterable<LLMStreamEvent>): AsyncIterable<LLMStreamEvent> {
    let totalTokens = 0;
    let totalCost = 0;

    for await (const event of source) {
      yield event;
      if (event.type === 'usage') {
        totalTokens = event.usage.totalTokens;
      }
      if (event.type === 'done') {
        totalCost = event.cost ?? 0;
        totalTokens = event.usage?.totalTokens ?? totalTokens;
      }
    }

    // Update budget after stream completes
    this.state.totalTokensUsed += totalTokens;
    this.state.totalCostUsed += totalCost;
    this.state.dailyTokensUsed += totalTokens;
    this.state.dailyCostUsed += totalCost;
    this.state.callCount++;
  }

  async streamGenerate(prompt: string, options?: StreamGenerateOptions): Promise<StreamResult> {
    if (!isStreamingAdapter(this.inner)) {
      throw new Error(`BudgetedLLM: inner adapter "${this.inner.name}" does not support streaming`);
    }
    this.checkPreCallBudget();
    const streamingInner = this.inner as LLMAdapter & StreamingLLMAdapter;
    const result = await streamingInner.streamGenerate(prompt, options);
    // Accumulate usage from StreamResult
    this.state.totalTokensUsed += result.usage.totalTokens;
    this.state.totalCostUsed += result.cost ?? 0;
    this.state.dailyTokensUsed += result.usage.totalTokens;
    this.state.dailyCostUsed += result.cost ?? 0;
    this.state.callCount++;
    return result;
  }

  // ---- State & control ----

  getState(): Readonly<BudgetState> {
    this.resetDailyIfNeeded();
    return { ...this.state };
  }

  getRemainingBudget(): {
    totalTokens?: number;
    totalCost?: number;
    dailyTokens?: number;
    dailyCost?: number;
  } {
    this.resetDailyIfNeeded();
    return {
      totalTokens:
        this.config.maxTotalTokens !== undefined
          ? Math.max(0, this.config.maxTotalTokens - this.state.totalTokensUsed)
          : undefined,
      totalCost:
        this.config.maxTotalCost !== undefined
          ? Math.max(0, this.config.maxTotalCost - this.state.totalCostUsed)
          : undefined,
      dailyTokens:
        this.config.maxDailyTokens !== undefined
          ? Math.max(0, this.config.maxDailyTokens - this.state.dailyTokensUsed)
          : undefined,
      dailyCost:
        this.config.maxDailyCost !== undefined
          ? Math.max(0, this.config.maxDailyCost - this.state.dailyCostUsed)
          : undefined,
    };
  }

  reset(): void {
    this.state = {
      totalTokensUsed: 0,
      totalCostUsed: 0,
      dailyTokensUsed: 0,
      dailyCostUsed: 0,
      dailyResetAt: this.nextMidnightUTC(),
      callCount: 0,
    };
  }

  getInnerLLM(): LLMAdapter {
    return this.inner;
  }
}
