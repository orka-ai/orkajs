import type { TraceCollector } from './collector.js';
import type { DevToolsConfig, TraceEvent } from './types.js';
import type { Application, Request, Response, NextFunction } from 'express';
import type { Server, ServerResponse } from 'http';

/**
 * DevTools Server - Express server for the DevTools dashboard
 */
export class DevToolsServer {
  private collector: TraceCollector;
  private config: Required<Pick<DevToolsConfig, 'port' | 'host' | 'cors'>>;
  private server?: Server;
  private clients: Set<ServerResponse> = new Set();

  constructor(collector: TraceCollector, config: DevToolsConfig = {}) {
    this.collector = collector;
    this.config = {
      port: config.port ?? 3001,
      host: config.host ?? 'localhost',
      cors: config.cors ?? true,
    };
  }

  /**
   * Start the DevTools server
   */
  async start(): Promise<void> {
    // Dynamic import for optional express dependency
    let expressModule: { default: () => Application; json: () => unknown };
    let httpModule: typeof import('http');
    
    try {
      expressModule = await import('express') as unknown as { default: () => Application; json: () => unknown };
      httpModule = await import('http');
    } catch {
      throw new Error(
        'Express is required for DevTools server. Install it with: npm install express'
      );
    }

    const app = expressModule.default();

    // CORS middleware
    if (this.config.cors) {
      app.use((_req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
        next();
      });
    }

    app.use(expressModule.json() as unknown as (req: Request, res: Response, next: NextFunction) => void);

    // API Routes
    this.setupRoutes(app);

    // Create HTTP server
    this.server = httpModule.createServer(app);

    // Start listening
    await new Promise<void>((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        console.log(`\n🔍 OrkaJS DevTools running at http://${this.config.host}:${this.config.port}\n`);
        resolve();
      });
    });

    // Subscribe to trace events for SSE
    this.collector.subscribe((event) => {
      this.broadcastEvent(event);
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.server = undefined;
    }
  }

  /**
   * Setup API routes
   */
  private setupRoutes(app: Application): void {
    // Health check
    app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Get all sessions
    app.get('/api/sessions', (_req: Request, res: Response) => {
      const sessions = this.collector.getSessions();
      res.json(sessions);
    });

    // Get a specific session
    app.get('/api/sessions/:id', (req: Request, res: Response) => {
      const session = this.collector.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json(session);
    });

    // Get metrics
    app.get('/api/metrics', (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string | undefined;
      const metrics = this.collector.getMetrics(sessionId);
      res.json(metrics);
    });

    // Find a run
    app.get('/api/runs/:id', (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string | undefined;
      const run = this.collector.findRun(req.params.id, sessionId);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      res.json(run);
    });

    // Clear all traces
    app.delete('/api/sessions', (_req: Request, res: Response) => {
      this.collector.clear();
      res.json({ success: true });
    });

    // Export traces
    app.get('/api/export', (_req: Request, res: Response) => {
      const data = this.collector.export();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=orka-traces.json');
      res.send(data);
    });

    // Import traces
    app.post('/api/import', (req: Request, res: Response) => {
      try {
        this.collector.import(JSON.stringify(req.body));
        res.json({ success: true });
      } catch {
        res.status(400).json({ error: 'Invalid trace data' });
      }
    });

    // Server-Sent Events for real-time updates
    app.get('/api/events', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      this.clients.add(res as unknown as ServerResponse);

      req.on('close', () => {
        this.clients.delete(res as unknown as ServerResponse);
      });
    });

    // Serve static UI (if available)
    app.get('/', (_req: Request, res: Response) => {
      res.send(this.getDashboardHTML());
    });
  }

  /**
   * Broadcast event to all SSE clients
   */
  private broadcastEvent(event: TraceEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      client.write(`data: ${data}\n\n`);
    }
  }

  /**
   * Get embedded dashboard HTML
   */
  private getDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OrkaJS DevTools</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .tree-line { border-left: 2px solid #e2e8f0; }
    .dark .tree-line { border-left-color: #334155; }
  </style>
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen">
  <div id="app" class="max-w-7xl mx-auto p-6">
    <header class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold">OrkaJS DevTools</h1>
          <p class="text-sm text-slate-500">Real-time LLM observability</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <span id="status" class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Connected
        </span>
        <button onclick="clearTraces()" class="px-3 py-1.5 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20">
          Clear
        </button>
        <button onclick="exportTraces()" class="px-3 py-1.5 text-sm bg-purple-500/10 text-purple-500 rounded-lg hover:bg-purple-500/20">
          Export
        </button>
      </div>
    </header>

    <!-- Metrics -->
    <div id="metrics" class="grid grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
        <p class="text-sm text-slate-500 mb-1">Total Runs</p>
        <p id="metric-runs" class="text-2xl font-bold">0</p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
        <p class="text-sm text-slate-500 mb-1">Avg Latency</p>
        <p id="metric-latency" class="text-2xl font-bold">0ms</p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
        <p class="text-sm text-slate-500 mb-1">Total Tokens</p>
        <p id="metric-tokens" class="text-2xl font-bold">0</p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
        <p class="text-sm text-slate-500 mb-1">Error Rate</p>
        <p id="metric-errors" class="text-2xl font-bold">0%</p>
      </div>
    </div>

    <!-- Sessions & Traces -->
    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-1">
        <h2 class="text-lg font-semibold mb-4">Sessions</h2>
        <div id="sessions" class="space-y-2"></div>
      </div>
      <div class="col-span-2">
        <h2 class="text-lg font-semibold mb-4">Trace Viewer</h2>
        <div id="traces" class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm min-h-[400px]">
          <p class="text-slate-500 text-center py-8">Select a session to view traces</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    let selectedSession = null;

    // SSE connection
    const events = new EventSource('/api/events');
    events.onmessage = (e) => {
      const event = JSON.parse(e.data);
      console.log('Event:', event);
      refreshData();
    };
    events.onerror = () => {
      document.getElementById('status').innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full"></span> Disconnected';
    };

    async function refreshData() {
      // Fetch metrics
      const metrics = await fetch('/api/metrics').then(r => r.json());
      document.getElementById('metric-runs').textContent = metrics.totalRuns;
      document.getElementById('metric-latency').textContent = Math.round(metrics.avgLatencyMs) + 'ms';
      document.getElementById('metric-tokens').textContent = metrics.totalTokens.toLocaleString();
      document.getElementById('metric-errors').textContent = (metrics.errorRate * 100).toFixed(1) + '%';

      // Fetch sessions
      const sessions = await fetch('/api/sessions').then(r => r.json());
      renderSessions(sessions);

      if (selectedSession) {
        const session = await fetch('/api/sessions/' + selectedSession).then(r => r.json());
        renderTraces(session.runs);
      }
    }

    function renderSessions(sessions) {
      const container = document.getElementById('sessions');
      container.innerHTML = sessions.map(s => \`
        <div onclick="selectSession('\${s.id}')" class="p-3 rounded-lg cursor-pointer \${selectedSession === s.id ? 'bg-purple-500/20 border border-purple-500' : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'}">
          <p class="font-medium">\${s.name || 'Session'}</p>
          <p class="text-xs text-slate-500">\${s.runs.length} runs • \${new Date(s.startTime).toLocaleTimeString()}</p>
        </div>
      \`).join('');
    }

    function selectSession(id) {
      selectedSession = id;
      refreshData();
    }

    function renderTraces(runs, depth = 0) {
      if (!runs || runs.length === 0) {
        document.getElementById('traces').innerHTML = '<p class="text-slate-500 text-center py-8">No traces in this session</p>';
        return;
      }

      const html = runs.map(run => renderRun(run, depth)).join('');
      document.getElementById('traces').innerHTML = html;
    }

    function renderRun(run, depth) {
      const statusColor = run.status === 'success' ? 'bg-green-500' : run.status === 'error' ? 'bg-red-500' : 'bg-yellow-500';
      const typeColors = {
        llm: 'text-purple-500',
        agent: 'text-blue-500',
        tool: 'text-orange-500',
        retrieval: 'text-green-500',
        chain: 'text-pink-500',
      };

      return \`
        <div class="mb-2" style="margin-left: \${depth * 20}px">
          <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <span class="w-2 h-2 rounded-full \${statusColor}"></span>
            <span class="text-xs font-medium \${typeColors[run.type] || 'text-slate-500'}">\${run.type.toUpperCase()}</span>
            <span class="font-medium">\${run.name}</span>
            <span class="text-xs text-slate-500 ml-auto">\${run.latencyMs ? run.latencyMs + 'ms' : 'running...'}</span>
            \${run.metadata?.totalTokens ? '<span class="text-xs text-slate-400">' + run.metadata.totalTokens + ' tokens</span>' : ''}
          </div>
          \${run.children.map(c => renderRun(c, depth + 1)).join('')}
        </div>
      \`;
    }

    async function clearTraces() {
      await fetch('/api/sessions', { method: 'DELETE' });
      selectedSession = null;
      refreshData();
    }

    function exportTraces() {
      window.open('/api/export', '_blank');
    }

    // Initial load
    refreshData();
  </script>
</body>
</html>`;
  }
}
