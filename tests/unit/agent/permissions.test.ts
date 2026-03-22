import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager } from '../../../packages/agent/src/permissions.js';
import type { AgentPermissions, Principal } from '../../../packages/agent/src/types.js';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  describe('setPermissions / getPermissions', () => {
    it('should set and get permissions for an agent', () => {
      const permissions: AgentPermissions = {
        agentId: 'test-agent',
        owner: 'user:admin',
        rules: [
          { action: 'read', principals: ['team:sales'] },
          { action: 'execute', principals: ['role:sales-rep'] },
        ],
      };

      manager.setPermissions('test-agent', permissions);
      const result = manager.getPermissions('test-agent');

      expect(result).toEqual(permissions);
    });

    it('should throw error if agentId mismatch', () => {
      const permissions: AgentPermissions = {
        agentId: 'different-agent',
        owner: 'user:admin',
        rules: [],
      };

      expect(() => manager.setPermissions('test-agent', permissions)).toThrow();
    });

    it('should return undefined for non-existent agent', () => {
      expect(manager.getPermissions('non-existent')).toBeUndefined();
    });
  });

  describe('removePermissions', () => {
    it('should remove permissions for an agent', () => {
      manager.setPermissions('test-agent', {
        agentId: 'test-agent',
        owner: 'user:admin',
        rules: [],
      });

      expect(manager.removePermissions('test-agent')).toBe(true);
      expect(manager.getPermissions('test-agent')).toBeUndefined();
    });

    it('should return false for non-existent agent', () => {
      expect(manager.removePermissions('non-existent')).toBe(false);
    });
  });

  describe('check', () => {
    beforeEach(() => {
      manager.setPermissions('sales-agent', {
        agentId: 'sales-agent',
        owner: 'user:admin',
        rules: [
          { action: 'read', principals: ['team:sales', 'team:marketing'] },
          { action: 'execute', principals: ['role:sales-rep'] },
          { action: 'edit', principals: ['role:admin'] },
          { action: 'clone', principals: ['role:developer'] },
        ],
      });
    });

    it('should allow owner to perform any action', () => {
      const principal: Principal = { type: 'user', id: 'admin' };

      const result = manager.check({
        principal,
        action: 'delete',
        agentId: 'sales-agent',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('owner');
    });

    it('should allow action when principal matches rule', () => {
      manager.registerPrincipalMemberships('user:john', ['team:sales', 'role:sales-rep']);

      const result = manager.check({
        principal: { type: 'user', id: 'john' },
        action: 'read',
        agentId: 'sales-agent',
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny action when principal does not match any rule', () => {
      const result = manager.check({
        principal: { type: 'user', id: 'unknown' },
        action: 'execute',
        agentId: 'sales-agent',
      });

      expect(result.allowed).toBe(false);
    });

    it('should deny when no permissions configured', () => {
      const result = manager.check({
        principal: { type: 'user', id: 'john' },
        action: 'read',
        agentId: 'non-existent',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No permissions configured');
    });

    it('should deny admin action for non-owner', () => {
      manager.registerPrincipalMemberships('user:john', ['role:admin']);

      const result = manager.check({
        principal: { type: 'user', id: 'john' },
        action: 'admin',
        agentId: 'sales-agent',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Only owner');
    });
  });

  describe('public agents', () => {
    it('should allow read for public agents', () => {
      manager.setPermissions('public-agent', {
        agentId: 'public-agent',
        owner: 'user:admin',
        rules: [],
        isPublic: true,
      });

      const result = manager.check({
        principal: { type: 'user', id: 'anyone' },
        action: 'read',
        agentId: 'public-agent',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('public');
    });

    it('should deny execute for public agents without explicit permission', () => {
      manager.setPermissions('public-agent', {
        agentId: 'public-agent',
        owner: 'user:admin',
        rules: [],
        isPublic: true,
      });

      const result = manager.check({
        principal: { type: 'user', id: 'anyone' },
        action: 'execute',
        agentId: 'public-agent',
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('principal memberships', () => {
    it('should register and retrieve memberships', () => {
      manager.registerPrincipalMemberships('user:john', ['team:sales', 'role:member']);

      const memberships = manager.getPrincipalMemberships('user:john');
      expect(memberships).toContain('team:sales');
      expect(memberships).toContain('role:member');
    });

    it('should add membership to existing principal', () => {
      manager.registerPrincipalMemberships('user:john', ['team:sales']);
      manager.addMembership('user:john', 'role:admin');

      const memberships = manager.getPrincipalMemberships('user:john');
      expect(memberships).toContain('team:sales');
      expect(memberships).toContain('role:admin');
    });

    it('should remove membership from principal', () => {
      manager.registerPrincipalMemberships('user:john', ['team:sales', 'role:member']);
      manager.removeMembership('user:john', 'team:sales');

      const memberships = manager.getPrincipalMemberships('user:john');
      expect(memberships).not.toContain('team:sales');
      expect(memberships).toContain('role:member');
    });
  });

  describe('grant / revoke', () => {
    beforeEach(() => {
      manager.setPermissions('test-agent', {
        agentId: 'test-agent',
        owner: 'user:admin',
        rules: [{ action: 'read', principals: ['team:sales'] }],
      });
    });

    it('should grant permission to new principals', () => {
      manager.grant('test-agent', 'read', ['team:marketing']);

      const permissions = manager.getPermissions('test-agent');
      const readRule = permissions?.rules.find(r => r.action === 'read');
      expect(readRule?.principals).toContain('team:marketing');
    });

    it('should create new rule when granting new action', () => {
      manager.grant('test-agent', 'execute', ['role:sales-rep']);

      const permissions = manager.getPermissions('test-agent');
      const executeRule = permissions?.rules.find(r => r.action === 'execute');
      expect(executeRule).toBeDefined();
      expect(executeRule?.principals).toContain('role:sales-rep');
    });

    it('should revoke permission from principals', () => {
      manager.revoke('test-agent', 'read', ['team:sales']);

      const permissions = manager.getPermissions('test-agent');
      const readRule = permissions?.rules.find(r => r.action === 'read');
      expect(readRule).toBeUndefined(); // Rule removed when no principals left
    });

    it('should throw when granting to non-existent agent', () => {
      expect(() => manager.grant('non-existent', 'read', ['team:sales'])).toThrow();
    });
  });

  describe('conditions', () => {
    it('should evaluate time range condition', () => {
      const now = new Date();
      const currentHour = now.getHours();

      manager.setPermissions('time-restricted', {
        agentId: 'time-restricted',
        owner: 'user:admin',
        rules: [{
          action: 'execute',
          principals: ['*'],
          conditions: [{
            type: 'time_range',
            config: {
              allowedHours: { start: currentHour, end: currentHour + 2 },
            },
          }],
        }],
      });

      const result = manager.check({
        principal: { type: 'user', id: 'anyone' },
        action: 'execute',
        agentId: 'time-restricted',
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny when time range condition fails', () => {
      manager.setPermissions('time-restricted', {
        agentId: 'time-restricted',
        owner: 'user:admin',
        rules: [{
          action: 'execute',
          principals: ['*'],
          conditions: [{
            type: 'time_range',
            config: {
              allowedHours: { start: 25, end: 26 }, // Impossible hours
            },
          }],
        }],
      });

      const result = manager.check({
        principal: { type: 'user', id: 'anyone' },
        action: 'execute',
        agentId: 'time-restricted',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('conditions not met');
    });

    it('should evaluate IP whitelist condition', () => {
      manager.setPermissions('ip-restricted', {
        agentId: 'ip-restricted',
        owner: 'user:admin',
        rules: [{
          action: 'execute',
          principals: ['*'],
          conditions: [{
            type: 'ip_whitelist',
            config: { ips: ['192.168.1.1', '10.0.0.0/8'] },
          }],
        }],
      });

      const result = manager.check({
        principal: { type: 'user', id: 'anyone' },
        action: 'execute',
        agentId: 'ip-restricted',
        context: { ipAddress: '192.168.1.1' },
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('inheritance', () => {
    it('should inherit permissions from parent', () => {
      manager.setPermissions('parent-agent', {
        agentId: 'parent-agent',
        owner: 'user:admin',
        rules: [{ action: 'read', principals: ['team:sales'] }],
      });

      manager.setPermissions('child-agent', {
        agentId: 'child-agent',
        owner: 'user:admin',
        rules: [],
        inheritFrom: 'parent-agent',
      });

      manager.registerPrincipalMemberships('user:john', ['team:sales']);

      const result = manager.check({
        principal: { type: 'user', id: 'john' },
        action: 'read',
        agentId: 'child-agent',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Inherited');
    });
  });

  describe('export / import', () => {
    it('should export and import permissions', () => {
      manager.setPermissions('agent-1', {
        agentId: 'agent-1',
        owner: 'user:admin',
        rules: [{ action: 'read', principals: ['team:sales'] }],
      });

      const exported = manager.export();
      
      const newManager = new PermissionManager();
      const imported = newManager.import(exported);

      expect(imported).toBe(1);
      expect(newManager.getPermissions('agent-1')).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      manager.setPermissions('agent-1', {
        agentId: 'agent-1',
        owner: 'user:admin',
        rules: [
          { action: 'read', principals: ['team:sales'] },
          { action: 'execute', principals: ['role:admin'] },
        ],
        isPublic: true,
      });

      manager.setPermissions('agent-2', {
        agentId: 'agent-2',
        owner: 'user:admin',
        rules: [{ action: 'read', principals: ['*'] }],
      });

      const stats = manager.getStats();

      expect(stats.totalAgents).toBe(2);
      expect(stats.publicAgents).toBe(1);
      expect(stats.totalRules).toBe(3);
      expect(stats.actionCounts.read).toBe(2);
      expect(stats.actionCounts.execute).toBe(1);
    });
  });
});
