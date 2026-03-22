import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '@orka-js/agent';
import type { AgentIdentity, AgentConfig } from '@orka-js/agent';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('register', () => {
    it('should register a new agent successfully', async () => {
      const identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'> = {
        id: 'sales-assistant-v1',
        name: 'Sales Assistant',
        role: 'CRM automation',
        description: 'Handles lead qualification and follow-ups',
        version: '1.0.0',
        metadata: {
          tags: ['sales', 'crm'],
          capabilities: ['email', 'calendar', 'database'],
        },
      };

      const config: AgentConfig = {
        goal: 'Qualify leads and schedule follow-ups',
        tools: [],
      };

      const registered = await registry.register(identity, config, 'react');

      expect(registered).toBeDefined();
      expect(registered.identity.id).toBe('sales-assistant-v1');
      expect(registered.identity.name).toBe('Sales Assistant');
      expect(registered.identity.createdAt).toBeInstanceOf(Date);
      expect(registered.identity.updatedAt).toBeInstanceOf(Date);
      expect(registered.type).toBe('react');
      expect(registered.config).toEqual(config);
    });

    it('should throw error if agent with same ID already exists', async () => {
      const identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'> = {
        id: 'duplicate-agent',
        name: 'Test Agent',
        role: 'Testing',
        description: 'Test',
        version: '1.0.0',
        metadata: {
          tags: [],
          capabilities: [],
        },
      };

      const config: AgentConfig = {
        goal: 'Test',
        tools: [],
      };

      await registry.register(identity, config, 'react');

      await expect(
        registry.register(identity, config, 'react')
      ).rejects.toThrow('already exists');
    });

    it('should validate required fields', async () => {
      const invalidIdentity = {
        id: '',
        name: 'Test',
        role: 'Test',
        description: 'Test',
        version: '1.0.0',
        metadata: {
          tags: [],
          capabilities: [],
        },
      };

      await expect(
        registry.register(invalidIdentity, { goal: 'Test', tools: [] }, 'react')
      ).rejects.toThrow('id is required');
    });

    it('should validate semantic version format', async () => {
      const identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'> = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Testing',
        description: 'Test',
        version: 'invalid-version',
        metadata: {
          tags: [],
          capabilities: [],
        },
      };

      await expect(
        registry.register(identity, { goal: 'Test', tools: [] }, 'react')
      ).rejects.toThrow('valid semantic version');
    });
  });

  describe('get', () => {
    it('should retrieve a registered agent by ID', async () => {
      const identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'> = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Testing',
        description: 'Test',
        version: '1.0.0',
        metadata: {
          tags: ['test'],
          capabilities: ['testing'],
        },
      };

      await registry.register(identity, { goal: 'Test', tools: [] }, 'react');

      const agent = registry.get('test-agent');
      expect(agent).toBeDefined();
      expect(agent?.identity.id).toBe('test-agent');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.get('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update agent identity', async () => {
      const identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'> = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Testing',
        description: 'Original description',
        version: '1.0.0',
        metadata: {
          tags: ['test'],
          capabilities: ['testing'],
        },
      };

      await registry.register(identity, { goal: 'Test', tools: [] }, 'react');

      const updated = await registry.update('test-agent', {
        identity: {
          description: 'Updated description',
          version: '1.1.0',
        },
      });

      expect(updated.identity.description).toBe('Updated description');
      expect(updated.identity.version).toBe('1.1.0');
      expect(updated.identity.name).toBe('Test Agent'); // Unchanged
    });

    it('should throw error for non-existent agent', async () => {
      await expect(
        registry.update('non-existent', { identity: { description: 'Test' } })
      ).rejects.toThrow('not found');
    });
  });

  describe('delete', () => {
    it('should delete an agent', async () => {
      const identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'> = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Testing',
        description: 'Test',
        version: '1.0.0',
        metadata: {
          tags: [],
          capabilities: [],
        },
      };

      await registry.register(identity, { goal: 'Test', tools: [] }, 'react');
      expect(registry.has('test-agent')).toBe(true);

      const deleted = registry.delete('test-agent');
      expect(deleted).toBe(true);
      expect(registry.has('test-agent')).toBe(false);
    });

    it('should return false for non-existent agent', () => {
      const deleted = registry.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Register multiple agents
      await registry.register(
        {
          id: 'sales-1',
          name: 'Sales Assistant',
          role: 'Sales',
          description: 'Sales automation',
          version: '1.0.0',
          metadata: {
            tags: ['sales', 'crm'],
            capabilities: ['email', 'calendar'],
            author: 'OrkaJS',
          },
        },
        { goal: 'Sales', tools: [] },
        'react'
      );

      await registry.register(
        {
          id: 'support-1',
          name: 'Support Assistant',
          role: 'Support',
          description: 'Customer support',
          version: '1.0.0',
          metadata: {
            tags: ['support', 'customer'],
            capabilities: ['chat', 'ticketing'],
            author: 'OrkaJS',
          },
        },
        { goal: 'Support', tools: [] },
        'plan-and-execute'
      );

      await registry.register(
        {
          id: 'marketing-1',
          name: 'Marketing Assistant',
          role: 'Marketing',
          description: 'Marketing automation',
          version: '1.0.0',
          metadata: {
            tags: ['marketing', 'analytics'],
            capabilities: ['analytics', 'reporting'],
            author: 'Community',
          },
        },
        { goal: 'Marketing', tools: [] },
        'react'
      );
    });

    it('should list all agents without filters', () => {
      const agents = registry.list();
      expect(agents).toHaveLength(3);
    });

    it('should filter by tags', () => {
      const agents = registry.list({ tags: ['sales'] });
      expect(agents).toHaveLength(1);
      expect(agents[0].identity.id).toBe('sales-1');
    });

    it('should filter by capabilities', () => {
      const agents = registry.list({ capabilities: ['email'] });
      expect(agents).toHaveLength(1);
      expect(agents[0].identity.id).toBe('sales-1');
    });

    it('should filter by role', () => {
      const agents = registry.list({ role: 'support' });
      expect(agents).toHaveLength(1);
      expect(agents[0].identity.id).toBe('support-1');
    });

    it('should filter by author', () => {
      const agents = registry.list({ author: 'OrkaJS' });
      expect(agents).toHaveLength(2);
    });

    it('should search in name and description', () => {
      const agents = registry.list({ search: 'automation' });
      expect(agents).toHaveLength(2); // sales and marketing
    });

    it('should limit results', () => {
      const agents = registry.list({ limit: 2 });
      expect(agents).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const agents = registry.list({
        tags: ['sales'],
        capabilities: ['email'],
        author: 'OrkaJS',
      });
      expect(agents).toHaveLength(1);
      expect(agents[0].identity.id).toBe('sales-1');
    });
  });

  describe('query', () => {
    it('should be an alias for list', async () => {
      await registry.register(
        {
          id: 'test-agent',
          name: 'Test',
          role: 'Test',
          description: 'Test',
          version: '1.0.0',
          metadata: {
            tags: ['test'],
            capabilities: [],
          },
        },
        { goal: 'Test', tools: [] },
        'react'
      );

      const listResult = registry.list({ tags: ['test'] });
      const queryResult = registry.query({ tags: ['test'] });

      expect(queryResult).toEqual(listResult);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await registry.register(
        {
          id: 'agent-1',
          name: 'Agent 1',
          role: 'Test',
          description: 'Test',
          version: '1.0.0',
          metadata: {
            tags: ['sales', 'crm'],
            capabilities: ['email', 'calendar'],
          },
        },
        { goal: 'Test', tools: [] },
        'react'
      );

      await registry.register(
        {
          id: 'agent-2',
          name: 'Agent 2',
          role: 'Test',
          description: 'Test',
          version: '1.0.0',
          metadata: {
            tags: ['sales', 'support'],
            capabilities: ['email', 'chat'],
          },
        },
        { goal: 'Test', tools: [] },
        'plan-and-execute'
      );
    });

    it('should return correct statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(2);
      expect(stats.agentsByType).toEqual({
        react: 1,
        'plan-and-execute': 1,
      });
      expect(stats.popularTags).toContainEqual({ tag: 'sales', count: 2 });
      expect(stats.popularCapabilities).toContainEqual({
        capability: 'email',
        count: 2,
      });
    });
  });

  describe('export and import', () => {
    it('should export agents as JSON', async () => {
      await registry.register(
        {
          id: 'test-agent',
          name: 'Test Agent',
          role: 'Testing',
          description: 'Test',
          version: '1.0.0',
          metadata: {
            tags: ['test'],
            capabilities: ['testing'],
          },
        },
        { goal: 'Test', tools: [] },
        'react'
      );

      const json = registry.export();
      expect(json).toBeDefined();

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].identity.id).toBe('test-agent');
    });

    it('should import agents from JSON', async () => {
      const json = JSON.stringify([
        {
          identity: {
            id: 'imported-agent',
            name: 'Imported Agent',
            role: 'Testing',
            description: 'Imported',
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              tags: ['imported'],
              capabilities: ['import'],
            },
          },
          config: {
            goal: 'Test',
            tools: [],
          },
          type: 'react',
        },
      ]);

      const imported = registry.import(json);
      expect(imported).toBe(1);
      expect(registry.has('imported-agent')).toBe(true);

      const agent = registry.get('imported-agent');
      expect(agent?.identity.name).toBe('Imported Agent');
    });

    it('should not overwrite existing agents by default', async () => {
      await registry.register(
        {
          id: 'existing-agent',
          name: 'Original',
          role: 'Test',
          description: 'Original',
          version: '1.0.0',
          metadata: {
            tags: [],
            capabilities: [],
          },
        },
        { goal: 'Test', tools: [] },
        'react'
      );

      const json = JSON.stringify([
        {
          identity: {
            id: 'existing-agent',
            name: 'Updated',
            role: 'Test',
            description: 'Updated',
            version: '2.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              tags: [],
              capabilities: [],
            },
          },
          config: {
            goal: 'Test',
            tools: [],
          },
          type: 'react',
        },
      ]);

      const imported = registry.import(json, false);
      expect(imported).toBe(0);

      const agent = registry.get('existing-agent');
      expect(agent?.identity.name).toBe('Original'); // Not updated
    });

    it('should overwrite existing agents when specified', async () => {
      await registry.register(
        {
          id: 'existing-agent',
          name: 'Original',
          role: 'Test',
          description: 'Original',
          version: '1.0.0',
          metadata: {
            tags: [],
            capabilities: [],
          },
        },
        { goal: 'Test', tools: [] },
        'react'
      );

      const json = JSON.stringify([
        {
          identity: {
            id: 'existing-agent',
            name: 'Updated',
            role: 'Test',
            description: 'Updated',
            version: '2.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              tags: [],
              capabilities: [],
            },
          },
          config: {
            goal: 'Test',
            tools: [],
          },
          type: 'react',
        },
      ]);

      const imported = registry.import(json, true);
      expect(imported).toBe(1);

      const agent = registry.get('existing-agent');
      expect(agent?.identity.name).toBe('Updated'); // Updated
    });
  });

  describe('clear', () => {
    it('should clear all agents', async () => {
      await registry.register(
        {
          id: 'agent-1',
          name: 'Agent 1',
          role: 'Test',
          description: 'Test',
          version: '1.0.0',
          metadata: {
            tags: [],
            capabilities: [],
          },
        },
        { goal: 'Test', tools: [] },
        'react'
      );

      expect(registry.size).toBe(1);

      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe('has', () => {
    it('should check if agent exists', async () => {
      expect(registry.has('test-agent')).toBe(false);

      await registry.register(
        {
          id: 'test-agent',
          name: 'Test',
          role: 'Test',
          description: 'Test',
          version: '1.0.0',
          metadata: {
            tags: [],
            capabilities: [],
          },
        },
        { goal: 'Test', tools: [] },
        'react'
      );

      expect(registry.has('test-agent')).toBe(true);
    });
  });
});
