import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { OrkaServerConfig, OrkaServerInstance } from './types.js';
import { createApiRouter } from './router.js';
import { WsManager } from './ws-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Creates and starts the Orka dev server with a React playground UI.
 *
 * @example
 * ```typescript
 * import { createOrkaServer } from '@orka-js/server';
 * import { myAgent } from './agent';
 *
 * const server = await createOrkaServer({
 *   agents: { assistant: myAgent },
 *   port: 4200,
 *   open: true,
 * });
 * console.log(`Server running at ${server.url}`);
 * ```
 */
export async function createOrkaServer(config: OrkaServerConfig): Promise<OrkaServerInstance> {
  const express = (await import('express')).default;
  const app = express();
  const port = config.port ?? 4200;
  const host = config.host ?? 'localhost';

  app.use(express.json());

  // CORS for dev
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  const wsManager = new WsManager();
  const broadcast = (agentName: string, event: unknown) => wsManager.broadcast(agentName, event);

  // API routes
  app.use('/api', createApiRouter(config.agents, broadcast));

  // Serve static UI files
  const uiPath = join(__dirname, 'ui');
  try {
    const serveStatic = (await import('serve-static')).default;
    app.use(serveStatic(uiPath));
    // SPA fallback
    app.get('*', (_req, res) => {
      res.sendFile(join(uiPath, 'index.html'));
    });
  } catch {
    // UI not built yet — serve a minimal status page
    app.get('/', (_req, res) => {
      res.send(`<html><body><h1>Orka Dev Server</h1><p>API: <a href="/api/agents">/api/agents</a></p><p>Build the UI with <code>pnpm build:ui</code></p></body></html>`);
    });
  }

  const httpServer = createServer(app);

  // Optional WebSocket server
  try {
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ server: httpServer });
    wss.on('connection', (ws) => wsManager.addClient(ws));
  } catch {
    // ws not installed — skip WebSocket support
  }

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => resolve());
  });

  const url = `http://${host}:${port}`;

  if (config.open) {
    openBrowser(url);
  }

  return {
    port,
    host,
    url,
    close: () => new Promise<void>((resolve, reject) => {
      httpServer.close((err) => err ? reject(err) : resolve());
    }),
  };
}

function openBrowser(url: string): void {
  const { exec } = require('child_process') as typeof import('child_process');
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open'
    : platform === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} ${url}`);
}
