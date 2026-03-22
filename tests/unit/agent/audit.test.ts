import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger } from '../../../packages/agent/src/audit.js';
import type { Principal, AuditEvent } from '../../../packages/agent/src/types.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  const testPrincipal: Principal = { type: 'user', id: 'john' };

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe('log', () => {
    it('should log an event with auto-generated id and timestamp', () => {
      const event = logger.log({
        type: 'agent.executed',
        principal: testPrincipal,
        agentId: 'test-agent',
        outcome: 'success',
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.type).toBe('agent.executed');
      expect(event.principal).toEqual(testPrincipal);
    });

    it('should store the event', () => {
      logger.log({
        type: 'agent.executed',
        principal: testPrincipal,
        agentId: 'test-agent',
        outcome: 'success',
      });

      expect(logger.size).toBe(1);
    });
  });

  describe('convenience methods', () => {
    it('should log agent registered', () => {
      const event = logger.logAgentRegistered(testPrincipal, 'new-agent');

      expect(event.type).toBe('agent.registered');
      expect(event.agentId).toBe('new-agent');
      expect(event.outcome).toBe('success');
    });

    it('should log agent updated', () => {
      const event = logger.logAgentUpdated(testPrincipal, 'test-agent', { name: 'New Name' });

      expect(event.type).toBe('agent.updated');
      expect(event.details?.changes).toEqual({ name: 'New Name' });
    });

    it('should log agent deleted', () => {
      const event = logger.logAgentDeleted(testPrincipal, 'test-agent');

      expect(event.type).toBe('agent.deleted');
      expect(event.outcome).toBe('success');
    });

    it('should log agent executed', () => {
      const event = logger.logAgentExecuted(
        testPrincipal,
        'test-agent',
        'success',
        { input: 'test', output: 'result' }
      );

      expect(event.type).toBe('agent.executed');
      expect(event.action).toBe('execute');
      expect(event.details).toEqual({ input: 'test', output: 'result' });
    });

    it('should log agent cloned', () => {
      const event = logger.logAgentCloned(testPrincipal, 'source-agent', 'cloned-agent');

      expect(event.type).toBe('agent.cloned');
      expect(event.agentId).toBe('source-agent');
      expect(event.details?.newAgentId).toBe('cloned-agent');
    });

    it('should log permission granted', () => {
      const event = logger.logPermissionGranted(
        testPrincipal,
        'test-agent',
        'execute',
        ['team:sales']
      );

      expect(event.type).toBe('permission.granted');
      expect(event.action).toBe('execute');
      expect(event.details?.grantedTo).toEqual(['team:sales']);
    });

    it('should log permission revoked', () => {
      const event = logger.logPermissionRevoked(
        testPrincipal,
        'test-agent',
        'execute',
        ['team:sales']
      );

      expect(event.type).toBe('permission.revoked');
      expect(event.details?.revokedFrom).toEqual(['team:sales']);
    });

    it('should log access allowed', () => {
      const event = logger.logAccessAllowed(
        testPrincipal,
        'test-agent',
        'read',
        'Matched rule'
      );

      expect(event.type).toBe('access.allowed');
      expect(event.outcome).toBe('success');
    });

    it('should log access denied', () => {
      const event = logger.logAccessDenied(
        testPrincipal,
        'test-agent',
        'execute',
        'No matching rule'
      );

      expect(event.type).toBe('access.denied');
      expect(event.outcome).toBe('denied');
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Create test events
      logger.logAgentExecuted(testPrincipal, 'agent-1', 'success');
      logger.logAgentExecuted(testPrincipal, 'agent-2', 'failure');
      logger.logAgentRegistered({ type: 'user', id: 'admin' }, 'agent-3');
      logger.logAccessDenied(testPrincipal, 'agent-1', 'execute', 'No permission');
    });

    it('should return all events when no filters', () => {
      const events = logger.query();
      expect(events.length).toBe(4);
    });

    it('should filter by event types', () => {
      const events = logger.query({ types: ['agent.executed'] });
      expect(events.length).toBe(2);
    });

    it('should filter by principal', () => {
      const events = logger.query({ principal: 'john' });
      expect(events.length).toBe(3);
    });

    it('should filter by agent ID', () => {
      const events = logger.query({ agentId: 'agent-1' });
      expect(events.length).toBe(2);
    });

    it('should filter by outcome', () => {
      const events = logger.query({ outcome: 'denied' });
      expect(events.length).toBe(1);
    });

    it('should apply limit', () => {
      const events = logger.query({ limit: 2 });
      expect(events.length).toBe(2);
    });

    it('should apply offset', () => {
      const allEvents = logger.query();
      const offsetEvents = logger.query({ offset: 2 });
      expect(offsetEvents.length).toBe(allEvents.length - 2);
    });

    it('should sort by timestamp (newest first)', () => {
      const events = logger.query();
      for (let i = 1; i < events.length; i++) {
        expect(events[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i].timestamp.getTime()
        );
      }
    });
  });

  describe('get', () => {
    it('should retrieve event by ID', () => {
      const logged = logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');
      const retrieved = logger.get(logged.id);

      expect(retrieved).toEqual(logged);
    });

    it('should return undefined for non-existent ID', () => {
      expect(logger.get('non-existent')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      logger.logAgentExecuted(testPrincipal, 'agent-1', 'success');
      logger.logAgentExecuted(testPrincipal, 'agent-1', 'success');
      logger.logAgentExecuted({ type: 'user', id: 'admin' }, 'agent-2', 'failure');
      logger.logAccessDenied(testPrincipal, 'agent-1', 'execute', 'No permission');
    });

    it('should return correct total events', () => {
      const stats = logger.getStats();
      expect(stats.totalEvents).toBe(4);
    });

    it('should count events by type', () => {
      const stats = logger.getStats();
      expect(stats.eventsByType['agent.executed']).toBe(3);
      expect(stats.eventsByType['access.denied']).toBe(1);
    });

    it('should count events by outcome', () => {
      const stats = logger.getStats();
      expect(stats.eventsByOutcome['success']).toBe(2);
      expect(stats.eventsByOutcome['failure']).toBe(1);
      expect(stats.eventsByOutcome['denied']).toBe(1);
    });

    it('should identify top principals', () => {
      const stats = logger.getStats();
      expect(stats.topPrincipals[0].principal).toBe('user:john');
      expect(stats.topPrincipals[0].count).toBe(3);
    });

    it('should identify top agents', () => {
      const stats = logger.getStats();
      expect(stats.topAgents[0].agentId).toBe('agent-1');
      expect(stats.topAgents[0].count).toBe(3);
    });

    it('should count access denied', () => {
      const stats = logger.getStats();
      expect(stats.accessDeniedCount).toBe(1);
    });
  });

  describe('event listeners', () => {
    it('should notify listeners on event', () => {
      const callback = vi.fn();
      logger.on('agent.executed', callback);

      logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent.executed',
      }));
    });

    it('should notify wildcard listeners on any event', () => {
      const callback = vi.fn();
      logger.on('*', callback);

      logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');
      logger.logAgentRegistered(testPrincipal, 'new-agent');

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe listener', () => {
      const callback = vi.fn();
      logger.on('agent.executed', callback);
      logger.off('agent.executed', callback);

      logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('export', () => {
    it('should export events as JSON', () => {
      logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');

      const exported = logger.export();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].type).toBe('agent.executed');
    });

    it('should export events as CSV', () => {
      logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');

      const csv = logger.exportCsv();
      const lines = csv.split('\n');

      expect(lines[0]).toContain('id,type,timestamp');
      expect(lines.length).toBe(2); // header + 1 event
    });
  });

  describe('cleanup', () => {
    it('should respect maxEvents limit', () => {
      const smallLogger = new AuditLogger({ maxEvents: 3 });

      for (let i = 0; i < 5; i++) {
        smallLogger.logAgentExecuted(testPrincipal, `agent-${i}`, 'success');
      }

      expect(smallLogger.size).toBe(3);
    });
  });

  describe('clear', () => {
    it('should remove all events', () => {
      logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');
      logger.logAgentExecuted(testPrincipal, 'test-agent', 'success');

      logger.clear();

      expect(logger.size).toBe(0);
    });
  });
});
