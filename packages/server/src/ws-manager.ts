/**
 * Simple WebSocket broadcast manager.
 * The actual WebSocket Server is created lazily to allow optional ws dependency.
 */
export class WsManager {
  private clients: Set<{ send(data: string): void; readyState: number }> = new Set();

  addClient(ws: { send(data: string): void; readyState: number; on(event: string, listener: () => void): void }): void {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
  }

  broadcast(agentName: string, event: unknown): void {
    const message = JSON.stringify({ agentName, event });
    for (const client of this.clients) {
      if (client.readyState === 1 /* OPEN */) {
        try { client.send(message); } catch { /* ignore */ }
      }
    }
  }

  get size(): number {
    return this.clients.size;
  }
}
