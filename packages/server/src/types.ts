import type { BaseAgent } from '@orka-js/agent';

export interface OrkaServerConfig {
  /** Map of agent name to agent instance */
  agents: Record<string, BaseAgent>;
  /** Port to listen on (default: 4200) */
  port?: number;
  /** Open browser automatically (default: false) */
  open?: boolean;
  /** Host to bind (default: 'localhost') */
  host?: string;
}

export interface OrkaServerInstance {
  port: number;
  host: string;
  url: string;
  close(): Promise<void>;
}
