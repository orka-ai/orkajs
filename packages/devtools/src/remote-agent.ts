import type { TraceCollector } from './collector.js';
import type { DevToolsConfig, TraceEvent, TraceSession } from './types.js';

/**
 * RemoteAgent - Sends traces to a remote collector endpoint
 * 
 * Used in production to forward traces from your AI application
 * to a centralized trace collection service.
 */
export class RemoteAgent {
  private unsubscribe?: () => void;
  private isRunning = false;
  private batchQueue: TraceEvent[] = [];
  private batchTimeout?: NodeJS.Timeout;
  private readonly batchSize = 10;
  private readonly batchIntervalMs = 1000;
  private readonly sessionSampling: Map<string, boolean> = new Map();

  constructor(
    private tracer: TraceCollector,
    private config: DevToolsConfig
  ) {
    if (!config.remote?.endpoint) {
      throw new Error('[RemoteAgent] Remote endpoint is required');
    }
  }

  /**
   * Start the remote agent - subscribes to trace events and forwards them
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Subscribe to trace events from local collector
    this.unsubscribe = this.tracer.subscribe((event) => {
      this.handleEvent(event);
    });

    if (this.config.verbose) {
      console.log(`[RemoteAgent] Started - sending traces to ${this.config.remote?.endpoint}`);
    }
  }

  /**
   * Stop the remote agent
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Unsubscribe from events
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    // Flush remaining batch
    if (this.batchQueue.length > 0) {
      await this.flushBatch();
    }

    // Clear batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    if (this.config.verbose) {
      console.log('[RemoteAgent] Stopped');
    }
  }

  /**
   * Handle incoming trace event
   */
  private handleEvent(event: TraceEvent): void {
    // Apply sampling per session, not per event: a single decision must cover
    // every event of a session so we never forward an orphaned run:end without
    // its run:start (or runs without their session).
    if (!this.shouldSampleSession(event)) {
      return;
    }

    // Add to batch queue
    this.batchQueue.push(event);

    // Flush if batch is full
    if (this.batchQueue.length >= this.batchSize) {
      this.flushBatch();
    } else if (!this.batchTimeout) {
      // Set timeout to flush after interval
      this.batchTimeout = setTimeout(() => {
        this.flushBatch();
      }, this.batchIntervalMs);
    }
  }

  /**
   * Decide whether an event's session is sampled in. The decision is made once
   * per session (on the first event seen for it) and reused for all subsequent
   * events, keeping each trace's event stream structurally intact.
   */
  private shouldSampleSession(event: TraceEvent): boolean {
    const sampling = this.config.remote?.sampling;
    if (sampling === undefined) return true;

    const { sessionId } = event;
    let decision = this.sessionSampling.get(sessionId);
    if (decision === undefined) {
      decision = Math.random() <= sampling;
      this.sessionSampling.set(sessionId, decision);
    }

    // Release the decision once the session is done to bound memory.
    if (event.type === 'session:end') {
      this.sessionSampling.delete(sessionId);
    }

    return decision;
  }

  /**
   * Flush the batch queue to the remote endpoint
   */
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const events = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    try {
      await this.sendToRemote(events);
    } catch (error) {
      // Log error but don't throw - we don't want to break the application
      console.error('[RemoteAgent] Failed to send traces:', error);
      
      // Optionally re-queue events for retry (with limit to prevent memory issues)
      if (this.batchQueue.length < this.batchSize * 5) {
        this.batchQueue.unshift(...events);
      }
    }
  }

  /**
   * Send events to the remote collector endpoint
   */
  private async sendToRemote(events: TraceEvent[]): Promise<void> {
    const endpoint = this.config.remote!.endpoint;
    const apiKey = this.config.remote?.apiKey;
    const projectId = this.config.remote?.projectId;
    const environment = this.config.remote?.environment;

    const payload = {
      projectId,
      environment,
      events,
      timestamp: Date.now(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${endpoint}/api/traces`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (this.config.verbose) {
      console.log(`[RemoteAgent] Sent ${events.length} events to ${endpoint}`);
    }
  }

  /**
   * Manually send a session to the remote collector
   */
  async sendSession(session: TraceSession): Promise<void> {
    const endpoint = this.config.remote!.endpoint;
    const apiKey = this.config.remote?.apiKey;
    const projectId = this.config.remote?.projectId;
    const environment = this.config.remote?.environment;

    const payload = {
      projectId,
      environment,
      session,
      timestamp: Date.now(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${endpoint}/api/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Check if the remote endpoint is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const endpoint = this.config.remote!.endpoint;
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        headers: this.config.remote?.apiKey 
          ? { 'Authorization': `Bearer ${this.config.remote.apiKey}` }
          : {},
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
