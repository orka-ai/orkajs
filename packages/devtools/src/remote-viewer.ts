import type { TraceCollector } from './collector.js';
import type { DevToolsConfig, TraceEvent, TraceSession } from './types.js';

/**
 * RemoteViewer - Listens to traces from a remote collector endpoint
 * 
 * Used by developers to view production traces in real-time
 * from their local DevTools dashboard.
 */
export class RemoteViewer {
  private eventSource?: EventSource;
  private isRunning = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelayMs = 1000;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor(
    private tracer: TraceCollector,
    private config: DevToolsConfig
  ) {
    if (!config.remote?.endpoint) {
      throw new Error('[RemoteViewer] Remote endpoint is required');
    }
  }

  /**
   * Start the remote viewer - connects to SSE stream and receives traces
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.connect();

    if (this.config.verbose) {
      console.log(`[RemoteViewer] Started - listening to ${this.config.remote?.endpoint}`);
    }
  }

  /**
   * Stop the remote viewer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Close SSE connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.config.verbose) {
      console.log('[RemoteViewer] Stopped');
    }
  }

  /**
   * Connect to the remote SSE stream
   */
  private async connect(): Promise<void> {
    const endpoint = this.config.remote!.endpoint;
    const projectId = this.config.remote?.projectId;
    const filters = this.config.remote?.filters;

    // Build query parameters
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (filters?.environment) params.set('environment', filters.environment);
    if (filters?.userId) params.set('userId', filters.userId);
    if (filters?.traceId) params.set('traceId', filters.traceId);
    if (filters?.sessionId) params.set('sessionId', filters.sessionId);
    if (filters?.timeRange) params.set('timeRange', filters.timeRange);
    if (filters?.tags) params.set('tags', JSON.stringify(filters.tags));

    const streamUrl = `${endpoint}/api/stream?${params.toString()}`;

    // The API key is sent via the Authorization header in connectWithFetch.
    // It must never be placed in the URL query string, where it would leak
    // into server access logs, proxy/CDN logs and URL-echoing error messages.
    this.connectWithFetch(streamUrl);
  }

  /**
   * Connect using fetch with streaming (works in Node.js)
   */
  private async connectWithFetch(url: string): Promise<void> {
    const apiKey = this.config.remote?.apiKey;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      if (this.config.verbose) {
        console.log('[RemoteViewer] Connected to stream');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (this.isRunning) {
        const { done, value } = await reader.read();
        
        if (done) {
          if (this.config.verbose) {
            console.log('[RemoteViewer] Stream ended');
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data && data !== '[DONE]') {
              try {
                const event = JSON.parse(data) as TraceEvent | { type: 'session'; session: TraceSession };
                this.handleRemoteEvent(event);
              } catch (e) {
                console.error('[RemoteViewer] Failed to parse event:', e);
              }
            }
          }
        }
      }

      // Attempt reconnect if still running
      if (this.isRunning) {
        this.scheduleReconnect();
      }
    } catch (error) {
      console.error('[RemoteViewer] Connection error:', error);
      
      if (this.isRunning) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Handle incoming event from remote stream
   */
  private handleRemoteEvent(event: TraceEvent | { type: 'session'; session: TraceSession }): void {
    if (this.config.verbose) {
      console.log('[RemoteViewer] Received event:', event.type);
    }

    // Handle session sync
    if ('session' in event) {
      this.syncSession(event.session);
      return;
    }

    // Handle trace events - replay them into local tracer
    switch (event.type) {
      case 'session:start':
        // Session already started remotely, just track it
        break;
      
      case 'session:end':
        this.tracer.endSession(event.sessionId);
        break;
      
      case 'run:start':
      case 'run:end':
      case 'run:error':
        // Ingest the remote run keyed by its own id so that follow-up
        // run:end/run:error events match and update it in place. Replaying
        // through startRun/endRun would mint a new local id and orphan every
        // remote run (it could never be ended).
        if (event.run) {
          this.tracer.ingestRun(event.sessionId, event.run);
        }
        break;
    }
  }

  /**
   * Sync a complete session from remote
   */
  private syncSession(session: TraceSession): void {
    // Import the session directly into the tracer
    const json = JSON.stringify({ sessions: [session] });
    this.tracer.import(json);

    if (this.config.verbose) {
      console.log(`[RemoteViewer] Synced session: ${session.id}`);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RemoteViewer] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);

    if (this.config.verbose) {
      console.log(`[RemoteViewer] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Fetch historical sessions from remote
   */
  async fetchSessions(options?: {
    limit?: number;
    offset?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<TraceSession[]> {
    const endpoint = this.config.remote!.endpoint;
    const apiKey = this.config.remote?.apiKey;
    const projectId = this.config.remote?.projectId;

    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.startTime) params.set('startTime', String(options.startTime));
    if (options?.endTime) params.set('endTime', String(options.endTime));

    const response = await fetch(`${endpoint}/api/sessions?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { sessions: TraceSession[] };
    return data.sessions;
  }

  /**
   * Check if connected to remote
   */
  isConnected(): boolean {
    return this.isRunning && this.reconnectAttempts === 0;
  }
}
