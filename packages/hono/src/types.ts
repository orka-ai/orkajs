import type { BaseAgent } from '@orka-js/agent';

export interface OrkaHonoConfig {
  /** Map of agent name → agent instance */
  agents: Record<string, BaseAgent>;
  /** Optional auth function — return false to reject with 401 */
  auth?: (c: { req: { header(name: string): string | undefined } }) => boolean | Promise<boolean>;
}
