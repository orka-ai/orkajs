/**
 * DI token factories and constants for @orka-js/nestjs.
 *
 * String tokens (ORKA_AGENT_TOKEN, ORKA_AGENT_CLIENT_TOKEN) are used for named
 * providers because they are human-readable, deterministic, and can be
 * inspected at runtime via app.get('ORKA_AGENT:myAgent').
 *
 * Symbol tokens (ORKA_MODULE_CONFIG, ORKA_AGENTS_MAP) are used for internal
 * module-level providers that users should not need to access directly.
 */

/** Unique Symbol token for the OrkaModule configuration object */
export const ORKA_MODULE_CONFIG = Symbol('ORKA_MODULE_CONFIG');

/** Unique Symbol token for the resolved agents map Record<string, BaseAgent> */
export const ORKA_AGENTS_MAP = Symbol('ORKA_AGENTS_MAP');

/**
 * Generates a unique string DI token for a named agent.
 * Convention: `ORKA_AGENT:myAgent`
 *
 * @example
 * providers: [{ provide: ORKA_AGENT_TOKEN('sales'), useValue: salesAgent }]
 * inject: [ORKA_AGENT_TOKEN('sales')]
 */
export function ORKA_AGENT_TOKEN(name: string): string {
  return `ORKA_AGENT:${name}`;
}

/**
 * Generates a unique string DI token for a named agent client (microservice proxy).
 * Convention: `ORKA_AGENT_CLIENT:myAgent`
 *
 * @example
 * inject: [ORKA_AGENT_CLIENT_TOKEN('remote')]
 */
export function ORKA_AGENT_CLIENT_TOKEN(name: string): string {
  return `ORKA_AGENT_CLIENT:${name}`;
}

/** Reflect metadata key used by @OrkaAgent decorator to store agent metadata */
export const ORKA_AGENT_METADATA = 'orka:agent';

/** Reflect metadata key used by @AgentReact decorator to store reaction options */
export const ORKA_REACT_METADATA = 'orka:react';
