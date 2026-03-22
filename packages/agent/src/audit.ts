import { generateId } from '@orka-js/core';
import type {
  Principal,
  PermissionAction,
  AuditEvent,
  AuditEventType,
  AuditMetadata,
  AuditQueryOptions,
  AuditStats,
} from './types.js';

/**
 * Audit Logger - Records all agent-related actions for compliance and debugging
 * 
 * Provides:
 * - Automatic event logging
 * - Query and filtering capabilities
 * - Statistics and analytics
 * - Export for compliance
 * 
 * @example
 * ```typescript
 * const audit = new AuditLogger();
 * 
 * // Log an event
 * audit.log({
 *   type: 'agent.executed',
 *   principal: { type: 'user', id: 'john' },
 *   agentId: 'sales-agent',
 *   outcome: 'success',
 *   details: { input: 'Qualify lead', output: 'Lead qualified' }
 * });
 * 
 * // Query events
 * const events = audit.query({ agentId: 'sales-agent', limit: 100 });
 * 
 * // Get statistics
 * const stats = audit.getStats();
 * ```
 */
export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents: number;
  private eventTtlMs: number;
  private listeners: Map<AuditEventType | '*', Set<(event: AuditEvent) => void>> = new Map();

  constructor(options: { maxEvents?: number; eventTtlMs?: number } = {}) {
    this.maxEvents = options.maxEvents ?? 10000;
    this.eventTtlMs = options.eventTtlMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days default
  }

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const fullEvent: AuditEvent = {
      id: generateId(),
      timestamp: new Date(),
      ...event,
    };

    this.events.push(fullEvent);
    this.cleanup();
    this.notifyListeners(fullEvent);

    return fullEvent;
  }

  /**
   * Log agent registration
   */
  logAgentRegistered(
    principal: Principal,
    agentId: string,
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'agent.registered',
      principal,
      agentId,
      outcome: 'success',
      metadata,
    });
  }

  /**
   * Log agent update
   */
  logAgentUpdated(
    principal: Principal,
    agentId: string,
    changes?: Record<string, unknown>,
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'agent.updated',
      principal,
      agentId,
      outcome: 'success',
      details: { changes },
      metadata,
    });
  }

  /**
   * Log agent deletion
   */
  logAgentDeleted(
    principal: Principal,
    agentId: string,
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'agent.deleted',
      principal,
      agentId,
      outcome: 'success',
      metadata,
    });
  }

  /**
   * Log agent execution
   */
  logAgentExecuted(
    principal: Principal,
    agentId: string,
    outcome: 'success' | 'failure',
    details?: Record<string, unknown>,
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'agent.executed',
      principal,
      agentId,
      action: 'execute',
      outcome,
      details,
      metadata,
    });
  }

  /**
   * Log agent clone
   */
  logAgentCloned(
    principal: Principal,
    sourceAgentId: string,
    newAgentId: string,
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'agent.cloned',
      principal,
      agentId: sourceAgentId,
      action: 'clone',
      outcome: 'success',
      details: { newAgentId },
      metadata,
    });
  }

  /**
   * Log permission granted
   */
  logPermissionGranted(
    principal: Principal,
    agentId: string,
    action: PermissionAction,
    grantedTo: string[],
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'permission.granted',
      principal,
      agentId,
      action,
      outcome: 'success',
      details: { grantedTo },
      metadata,
    });
  }

  /**
   * Log permission revoked
   */
  logPermissionRevoked(
    principal: Principal,
    agentId: string,
    action: PermissionAction,
    revokedFrom: string[],
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'permission.revoked',
      principal,
      agentId,
      action,
      outcome: 'success',
      details: { revokedFrom },
      metadata,
    });
  }

  /**
   * Log access allowed
   */
  logAccessAllowed(
    principal: Principal,
    agentId: string,
    action: PermissionAction,
    reason: string,
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'access.allowed',
      principal,
      agentId,
      action,
      outcome: 'success',
      details: { reason },
      metadata,
    });
  }

  /**
   * Log access denied
   */
  logAccessDenied(
    principal: Principal,
    agentId: string,
    action: PermissionAction,
    reason: string,
    metadata?: AuditMetadata
  ): AuditEvent {
    return this.log({
      type: 'access.denied',
      principal,
      agentId,
      action,
      outcome: 'denied',
      details: { reason },
      metadata,
    });
  }

  /**
   * Query audit events
   */
  query(options: AuditQueryOptions = {}): AuditEvent[] {
    let results = [...this.events];

    // Filter by types
    if (options.types && options.types.length > 0) {
      results = results.filter(e => options.types!.includes(e.type));
    }

    // Filter by principal
    if (options.principal) {
      results = results.filter(e => 
        e.principal.id === options.principal ||
        `${e.principal.type}:${e.principal.id}` === options.principal
      );
    }

    // Filter by agent ID
    if (options.agentId) {
      results = results.filter(e => e.agentId === options.agentId);
    }

    // Filter by outcome
    if (options.outcome) {
      results = results.filter(e => e.outcome === options.outcome);
    }

    // Filter by date range
    if (options.from) {
      results = results.filter(e => e.timestamp >= options.from!);
    }
    if (options.to) {
      results = results.filter(e => e.timestamp <= options.to!);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get a single event by ID
   */
  get(eventId: string): AuditEvent | undefined {
    return this.events.find(e => e.id === eventId);
  }

  /**
   * Get statistics about audit events
   */
  getStats(options: { from?: Date; to?: Date } = {}): AuditStats {
    let events = this.events;

    // Filter by date range
    if (options.from) {
      events = events.filter(e => e.timestamp >= options.from!);
    }
    if (options.to) {
      events = events.filter(e => e.timestamp <= options.to!);
    }

    // Count by type
    const eventsByType: Record<string, number> = {};
    events.forEach(e => {
      eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
    });

    // Count by outcome
    const eventsByOutcome: Record<string, number> = {};
    events.forEach(e => {
      eventsByOutcome[e.outcome] = (eventsByOutcome[e.outcome] || 0) + 1;
    });

    // Top principals
    const principalCounts = new Map<string, number>();
    events.forEach(e => {
      const key = `${e.principal.type}:${e.principal.id}`;
      principalCounts.set(key, (principalCounts.get(key) || 0) + 1);
    });
    const topPrincipals = Array.from(principalCounts.entries())
      .map(([principal, count]) => ({ principal, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top agents
    const agentCounts = new Map<string, number>();
    events.forEach(e => {
      if (e.agentId) {
        agentCounts.set(e.agentId, (agentCounts.get(e.agentId) || 0) + 1);
      }
    });
    const topAgents = Array.from(agentCounts.entries())
      .map(([agentId, count]) => ({ agentId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Access denied count
    const accessDeniedCount = events.filter(e => e.outcome === 'denied').length;

    return {
      totalEvents: events.length,
      eventsByType: eventsByType as Record<AuditEventType, number>,
      eventsByOutcome,
      topPrincipals,
      topAgents,
      accessDeniedCount,
    };
  }

  /**
   * Subscribe to audit events
   */
  on(type: AuditEventType | '*', callback: (event: AuditEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  /**
   * Unsubscribe from audit events
   */
  off(type: AuditEventType | '*', callback: (event: AuditEvent) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Notify listeners of an event
   */
  private notifyListeners(event: AuditEvent): void {
    // Notify specific type listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(callback => callback(event));
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(callback => callback(event));
    }
  }

  /**
   * Export events as JSON
   */
  export(options: AuditQueryOptions = {}): string {
    const events = this.query(options);
    return JSON.stringify(events.map(e => ({
      ...e,
      timestamp: e.timestamp.toISOString(),
    })), null, 2);
  }

  /**
   * Export events as CSV
   */
  exportCsv(options: AuditQueryOptions = {}): string {
    const events = this.query(options);
    const headers = ['id', 'type', 'timestamp', 'principal_type', 'principal_id', 'agent_id', 'action', 'outcome'];
    const rows = events.map(e => [
      e.id,
      e.type,
      e.timestamp.toISOString(),
      e.principal.type,
      e.principal.id,
      e.agentId || '',
      e.action || '',
      e.outcome,
    ]);

    return [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ].join('\n');
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get total event count
   */
  get size(): number {
    return this.events.length;
  }

  /**
   * Cleanup old events based on TTL and max count
   */
  private cleanup(): void {
    const now = Date.now();

    // Remove expired events
    this.events = this.events.filter(e => 
      now - e.timestamp.getTime() < this.eventTtlMs
    );

    // Remove oldest events if over limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }
}

/**
 * Global audit logger instance
 */
export const globalAuditLogger = new AuditLogger();
