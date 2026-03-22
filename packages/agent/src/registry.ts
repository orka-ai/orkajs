import { OrkaError, OrkaErrorCode } from '@orka-js/core';
import type {
  AgentIdentity,
  RegisteredAgent,
  AgentConfig,
  AgentQueryOptions,
  AgentRegistryStats,
} from './types.js';

/**
 * Agent Registry - Central repository for managing agents
 * 
 * Provides:
 * - Agent registration and discovery
 * - Metadata-based filtering
 * - Version management
 * - Agent lifecycle management
 * 
 * @example
 * ```typescript
 * const registry = new AgentRegistry();
 * 
 * // Register an agent
 * await registry.register({
 *   id: "sales-assistant-v1",
 *   name: "Sales Assistant",
 *   role: "CRM automation",
 *   description: "Handles lead qualification and follow-ups",
 *   version: "1.0.0",
 *   metadata: {
 *     tags: ["sales", "crm"],
 *     capabilities: ["email", "calendar", "database"]
 *   }
 * }, agentConfig, "react");
 * 
 * // Find agents
 * const agents = await registry.query({ tags: ["sales"] });
 * ```
 */
export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map();

  /**
   * Register a new agent in the registry
   * 
   * @param identity - Agent identity information
   * @param config - Agent configuration
   * @param type - Agent type
   * @throws {OrkaError} If agent with same ID already exists
   */
  async register(
    identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'>,
    config: AgentConfig,
    type: RegisteredAgent['type']
  ): Promise<RegisteredAgent> {
    // Validate identity
    this.validateIdentity(identity);

    // Check if agent already exists
    if (this.agents.has(identity.id)) {
      throw new OrkaError(
        `Agent with id "${identity.id}" already exists. Use update() to modify existing agents.`,
        OrkaErrorCode.AGENT_ALREADY_EXISTS,
        'AgentRegistry',
        undefined,
        { agentId: identity.id }
      );
    }

    // Create full identity with timestamps
    const fullIdentity: AgentIdentity = {
      ...identity,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create registered agent
    const registeredAgent: RegisteredAgent = {
      identity: fullIdentity,
      config,
      type,
      instance: undefined, // Lazy-loaded
    };

    // Store in registry
    this.agents.set(identity.id, registeredAgent);

    return registeredAgent;
  }

  /**
   * Update an existing agent
   * 
   * @param id - Agent ID
   * @param updates - Partial updates to apply
   * @throws {OrkaError} If agent not found
   */
  async update(
    id: string,
    updates: {
      identity?: Partial<Omit<AgentIdentity, 'id' | 'createdAt' | 'updatedAt'>>;
      config?: Partial<AgentConfig>;
    }
  ): Promise<RegisteredAgent> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new OrkaError(
        `Agent with id "${id}" not found`,
        OrkaErrorCode.AGENT_NOT_FOUND,
        'AgentRegistry',
        undefined,
        { agentId: id }
      );
    }

    // Update identity
    if (updates.identity) {
      agent.identity = {
        ...agent.identity,
        ...updates.identity,
        updatedAt: new Date(),
      };
    }

    // Update config
    if (updates.config) {
      agent.config = {
        ...agent.config,
        ...updates.config,
      };
    }

    // Clear instance to force re-instantiation
    agent.instance = undefined;

    return agent;
  }

  /**
   * Get an agent by ID
   * 
   * @param id - Agent ID
   * @returns Registered agent or undefined if not found
   */
  get(id: string): RegisteredAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Delete an agent from the registry
   * 
   * @param id - Agent ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * List all registered agents
   * 
   * @param options - Query options for filtering
   * @returns Array of registered agents matching the query
   */
  list(options?: AgentQueryOptions): RegisteredAgent[] {
    let results = Array.from(this.agents.values());

    if (!options) {
      return results;
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((agent) =>
        options.tags!.some((tag) => agent.identity.metadata.tags.includes(tag))
      );
    }

    // Filter by capabilities
    if (options.capabilities && options.capabilities.length > 0) {
      results = results.filter((agent) =>
        options.capabilities!.some((cap) =>
          agent.identity.metadata.capabilities.includes(cap)
        )
      );
    }

    // Filter by role
    if (options.role) {
      results = results.filter((agent) =>
        agent.identity.role.toLowerCase().includes(options.role!.toLowerCase())
      );
    }

    // Filter by author
    if (options.author) {
      results = results.filter(
        (agent) => agent.identity.metadata.author === options.author
      );
    }

    // Search in name/description
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter(
        (agent) =>
          agent.identity.name.toLowerCase().includes(searchLower) ||
          agent.identity.description.toLowerCase().includes(searchLower)
      );
    }

    // Limit results
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Query agents with advanced filtering
   * Alias for list() for better API semantics
   */
  query(options: AgentQueryOptions): RegisteredAgent[] {
    return this.list(options);
  }

  /**
   * Get registry statistics
   * 
   * @returns Statistics about registered agents
   */
  getStats(): AgentRegistryStats {
    const agents = Array.from(this.agents.values());

    // Count by type
    const agentsByType: Record<string, number> = {};
    agents.forEach((agent) => {
      agentsByType[agent.type] = (agentsByType[agent.type] || 0) + 1;
    });

    // Count tags
    const tagCounts = new Map<string, number>();
    agents.forEach((agent) => {
      agent.identity.metadata.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // Count capabilities
    const capabilityCounts = new Map<string, number>();
    agents.forEach((agent) => {
      agent.identity.metadata.capabilities.forEach((cap) => {
        capabilityCounts.set(cap, (capabilityCounts.get(cap) || 0) + 1);
      });
    });

    // Sort and format
    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const popularCapabilities = Array.from(capabilityCounts.entries())
      .map(([capability, count]) => ({ capability, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAgents: agents.length,
      agentsByType,
      popularTags,
      popularCapabilities,
    };
  }

  /**
   * Clear all agents from the registry
   * Useful for testing or reset scenarios
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Get the number of registered agents
   */
  get size(): number {
    return this.agents.size;
  }

  /**
   * Check if an agent exists
   */
  has(id: string): boolean {
    return this.agents.has(id);
  }

  /**
   * Export all agents as JSON
   * Useful for backup or migration
   */
  export(): string {
    const agents = Array.from(this.agents.values()).map((agent) => ({
      identity: {
        ...agent.identity,
        createdAt: agent.identity.createdAt.toISOString(),
        updatedAt: agent.identity.updatedAt.toISOString(),
      },
      config: agent.config,
      type: agent.type,
    }));

    return JSON.stringify(agents, null, 2);
  }

  /**
   * Import agents from JSON
   * 
   * @param json - JSON string containing agents
   * @param overwrite - Whether to overwrite existing agents
   */
  import(json: string, overwrite = false): number {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) {
      throw new OrkaError(
        'Invalid import data: expected array of agents',
        OrkaErrorCode.INVALID_INPUT,
        'AgentRegistry'
      );
    }

    let imported = 0;
    for (const item of data) {
      const { identity, config, type } = item;

      // Skip if exists and not overwriting
      if (this.agents.has(identity.id) && !overwrite) {
        continue;
      }

      // Convert ISO strings back to Date objects
      const fullIdentity: AgentIdentity = {
        ...identity,
        createdAt: new Date(identity.createdAt),
        updatedAt: new Date(identity.updatedAt),
      };

      this.agents.set(identity.id, {
        identity: fullIdentity,
        config,
        type,
        instance: undefined,
      });

      imported++;
    }

    return imported;
  }

  /**
   * Validate agent identity
   * @private
   */
  private validateIdentity(
    identity: Omit<AgentIdentity, 'createdAt' | 'updatedAt'>
  ): void {
    if (!identity.id || identity.id.trim() === '') {
      throw new OrkaError('Agent id is required', OrkaErrorCode.INVALID_INPUT, 'AgentRegistry');
    }

    if (!identity.name || identity.name.trim() === '') {
      throw new OrkaError('Agent name is required', OrkaErrorCode.INVALID_INPUT, 'AgentRegistry');
    }

    if (!identity.role || identity.role.trim() === '') {
      throw new OrkaError('Agent role is required', OrkaErrorCode.INVALID_INPUT, 'AgentRegistry');
    }

    if (!identity.version || !this.isValidVersion(identity.version)) {
      throw new OrkaError(
        'Agent version must be a valid semantic version (e.g., "1.0.0")',
        OrkaErrorCode.INVALID_INPUT,
        'AgentRegistry'
      );
    }

    if (!identity.metadata) {
      throw new OrkaError(
        'Agent metadata is required',
        OrkaErrorCode.INVALID_INPUT,
        'AgentRegistry'
      );
    }

    if (!Array.isArray(identity.metadata.tags)) {
      throw new OrkaError(
        'Agent metadata.tags must be an array',
        OrkaErrorCode.INVALID_INPUT,
        'AgentRegistry'
      );
    }

    if (!Array.isArray(identity.metadata.capabilities)) {
      throw new OrkaError(
        'Agent metadata.capabilities must be an array',
        OrkaErrorCode.INVALID_INPUT,
        'AgentRegistry'
      );
    }
  }

  /**
   * Validate semantic version
   * @private
   */
  private isValidVersion(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    return semverRegex.test(version);
  }
}

/**
 * Global agent registry instance
 * Use this for application-wide agent management
 */
export const globalAgentRegistry = new AgentRegistry();
