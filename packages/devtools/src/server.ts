import type { TraceCollector } from './collector.js';
import type { DevToolsConfig, TraceEvent } from './types.js';
import type { Application, Request, Response, NextFunction } from 'express';
import type { Server, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * DevTools Server - Express server for the DevTools dashboard
 */
export class DevToolsServer {
  private collector: TraceCollector;
  private config: Required<Pick<DevToolsConfig, 'port' | 'host' | 'cors'>>;
  private server?: Server;
  private clients: Set<ServerResponse> = new Set();
  private dashboardHTML: string;

  constructor(collector: TraceCollector, config: DevToolsConfig = {}) {
    this.collector = collector;
    this.config = {
      port: config.port ?? 3001,
      host: config.host ?? 'localhost',
      cors: config.cors ?? true,
    };
    this.dashboardHTML = this.loadDashboardHTML();
  }

  /**
   * Load dashboard HTML from file
   */
  private loadDashboardHTML(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      return readFileSync(join(__dirname, 'dashboard.html'), 'utf-8');
    } catch {
      // Fallback to inline HTML if file not found
      return this.getInlineDashboardHTML();
    }
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
      res.send(this.dashboardHTML);
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
   * Inline fallback dashboard HTML
   */
  private getInlineDashboardHTML(): string {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>OrkaJS DevTools</title><script src="https://cdn.tailwindcss.com"><\/script><script>tailwind.config={darkMode:"class"}<\/script><style>.tree-line{border-left:2px solid #e2e8f0}.dark .tree-line{border-left-color:#334155}.scrollbar-thin::-webkit-scrollbar{width:6px}.scrollbar-thin::-webkit-scrollbar-thumb{background:#64748b;border-radius:3px}</style></head><body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen"><div id="app" class="max-w-7xl mx-auto p-6"><header class="flex items-center justify-between mb-8"><div class="flex items-center gap-3"><img src="https://devtools.orkajs.com/orka-devtools.png" alt="OrkaJS" class="w-10 h-10 rounded-lg" onerror="this.style.display=\'none\'"><div><h1 class="text-2xl font-bold">OrkaJS DevTools</h1><p class="text-sm text-slate-500">Real-time LLM observability</p></div></div><div class="flex items-center gap-3"><span id="status" class="flex items-center gap-2 text-sm px-3 py-1.5 bg-green-500/10 rounded-lg"><span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span><span class="text-green-600 dark:text-green-400">Live</span></span><button onclick="toggleTheme()" class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"><svg id="themeIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg></button><button onclick="clearTraces()" class="px-3 py-2 text-sm bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20">Clear</button><button onclick="exportTraces()" class="px-3 py-2 text-sm bg-purple-500/10 text-purple-600 rounded-lg hover:bg-purple-500/20">Export</button></div></header><div class="grid grid-cols-4 gap-4 mb-8"><div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"><p class="text-sm text-slate-500 mb-1">Total Runs</p><p id="metric-runs" class="text-2xl font-bold">0</p></div><div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"><p class="text-sm text-slate-500 mb-1">Avg Latency</p><p id="metric-latency" class="text-2xl font-bold">0ms</p></div><div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"><p class="text-sm text-slate-500 mb-1">Total Tokens</p><p id="metric-tokens" class="text-2xl font-bold">0</p></div><div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"><p class="text-sm text-slate-500 mb-1">Error Rate</p><p id="metric-errors" class="text-2xl font-bold">0%</p></div></div><div class="grid grid-cols-3 gap-6"><div class="col-span-1"><h2 class="text-lg font-semibold mb-4">Sessions</h2><div id="sessions" class="space-y-2"></div></div><div class="col-span-2"><h2 class="text-lg font-semibold mb-4">Trace Viewer</h2><div id="traces" class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm min-h-[400px]"><p class="text-slate-500 text-center py-8">Select a session to view traces</p></div></div></div></div><script>let selectedSession=null;function initTheme(){const t=localStorage.getItem("orka-devtools-theme");("dark"===t||!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)&&document.documentElement.classList.add("dark")}initTheme();function toggleTheme(){const t=document.documentElement.classList.toggle("dark");localStorage.setItem("orka-devtools-theme",t?"dark":"light")}const events=new EventSource("/api/events");events.onmessage=e=>{refreshData()};events.onerror=()=>{document.getElementById("status").innerHTML=\'<span class="w-2 h-2 bg-red-500 rounded-full"></span><span class="text-red-600">Disconnected</span>\'};async function refreshData(){const[t,e]=await Promise.all([fetch("/api/metrics").then(t=>t.json()),fetch("/api/sessions").then(t=>t.json())]);document.getElementById("metric-runs").textContent=t.totalRuns;document.getElementById("metric-latency").textContent=Math.round(t.avgLatencyMs)+"ms";document.getElementById("metric-tokens").textContent=t.totalTokens.toLocaleString();document.getElementById("metric-errors").textContent=(100*t.errorRate).toFixed(1)+"%";renderSessions(e);if(selectedSession){const t=e.find(t=>t.id===selectedSession);t&&renderTraces(t.runs)}}function renderSessions(t){document.getElementById("sessions").innerHTML=t.map(t=>`<div onclick="selectSession(\'${t.id}\')" class="p-3 rounded-lg cursor-pointer ${selectedSession===t.id?"bg-purple-500/20 border border-purple-500":"bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"}"><p class="font-medium">${t.name||"Session"}</p><p class="text-xs text-slate-500">${t.runs.length} runs</p></div>`).join("")}function selectSession(t){selectedSession=t;refreshData()}function renderTraces(t){if(!t||0===t.length)return void(document.getElementById("traces").innerHTML=\'<p class="text-slate-500 text-center py-8">No traces</p>\');document.getElementById("traces").innerHTML=t.map(t=>renderRun(t,0)).join("")}function renderRun(t,e){const s={success:"bg-green-500",error:"bg-red-500",running:"bg-yellow-500"},n={llm:"text-purple-500",agent:"text-blue-500",tool:"text-orange-500"};return`<div class="mb-2" style="margin-left:${20*e}px"><div class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><span class="w-2 h-2 rounded-full ${s[t.status]||"bg-slate-400"}"></span><span class="text-xs font-medium ${n[t.type]||"text-slate-500"}">${t.type.toUpperCase()}</span><span class="font-medium">${t.name}</span><span class="text-xs text-slate-500 ml-auto">${t.latencyMs?t.latencyMs+"ms":"..."}</span></div>${(t.children||[]).map(t=>renderRun(t,e+1)).join("")}</div>`}async function clearTraces(){confirm("Clear all traces?")&&(await fetch("/api/sessions",{method:"DELETE"}),selectedSession=null,refreshData())}function exportTraces(){window.open("/api/export","_blank")}refreshData()<\/script></body></html>';
  }
}
