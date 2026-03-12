import { Memory, type Message, type MemoryConfig } from './memory.js';

export interface SessionMemoryConfig extends MemoryConfig {
  sessionTTL?: number;
}

interface Session {
  memory: Memory;
  createdAt: number;
  lastAccessedAt: number;
}

export class SessionMemory {
  private sessions: Map<string, Session> = new Map();
  private defaultConfig: SessionMemoryConfig;

  constructor(config: SessionMemoryConfig = {}) {
    this.defaultConfig = {
      maxMessages: config.maxMessages ?? 50,
      maxTokensEstimate: config.maxTokensEstimate ?? 4000,
      strategy: config.strategy ?? 'sliding_window',
      sessionTTL: config.sessionTTL ?? 30 * 60 * 1000,
    };
  }

  getSession(sessionId: string): Memory {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        memory: new Memory(this.defaultConfig),
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    } else {
      session.lastAccessedAt = Date.now();
    }

    return session.memory;
  }

  addMessage(sessionId: string, message: Message): void {
    const memory = this.getSession(sessionId);
    memory.addMessage(message);
  }

  getHistory(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId);
    return session ? session.memory.getHistory() : [];
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  clearExpiredSessions(): number {
    const now = Date.now();
    const ttl = this.defaultConfig.sessionTTL ?? 30 * 60 * 1000;
    let cleared = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > ttl) {
        this.sessions.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  getActiveSessions(): string[] {
    return [...this.sessions.keys()];
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
