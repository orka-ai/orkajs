import { OrkaError, OrkaErrorCode } from '@orka-js/core';
import type {
  Principal,
  PermissionAction,
  PermissionCondition,
  AgentPermissions,
  PermissionCheckRequest,
  PermissionCheckResult,
} from './types.js';

/**
 * Permission Manager - Handles RBAC for agents
 * 
 * Provides:
 * - Permission configuration per agent
 * - Principal-based access control (user, team, role, service)
 * - Condition-based permissions (time, IP, rate limit)
 * - Permission inheritance
 * 
 * @example
 * ```typescript
 * const permissions = new PermissionManager();
 * 
 * // Set permissions for an agent
 * permissions.setPermissions('sales-agent', {
 *   agentId: 'sales-agent',
 *   owner: 'user:admin',
 *   rules: [
 *     { action: 'read', principals: ['team:sales', 'team:marketing'] },
 *     { action: 'execute', principals: ['role:sales-rep'] },
 *     { action: 'edit', principals: ['role:admin'] }
 *   ]
 * });
 * 
 * // Check permission
 * const result = permissions.check({
 *   principal: { type: 'user', id: 'user:john' },
 *   action: 'execute',
 *   agentId: 'sales-agent'
 * });
 * ```
 */
export class PermissionManager {
  private permissions: Map<string, AgentPermissions> = new Map();
  private principalMemberships: Map<string, Set<string>> = new Map();

  /**
   * Set permissions for an agent
   */
  setPermissions(agentId: string, config: AgentPermissions): void {
    if (config.agentId !== agentId) {
      throw new OrkaError(
        'Agent ID mismatch in permissions config',
        OrkaErrorCode.INVALID_INPUT,
        'PermissionManager'
      );
    }
    this.permissions.set(agentId, config);
  }

  /**
   * Get permissions for an agent
   */
  getPermissions(agentId: string): AgentPermissions | undefined {
    return this.permissions.get(agentId);
  }

  /**
   * Remove permissions for an agent
   */
  removePermissions(agentId: string): boolean {
    return this.permissions.delete(agentId);
  }

  /**
   * Register a principal's memberships (teams, roles)
   * This allows checking if a user belongs to a team or has a role
   */
  registerPrincipalMemberships(principalId: string, memberships: string[]): void {
    this.principalMemberships.set(principalId, new Set(memberships));
  }

  /**
   * Get a principal's memberships
   */
  getPrincipalMemberships(principalId: string): string[] {
    const memberships = this.principalMemberships.get(principalId);
    return memberships ? Array.from(memberships) : [];
  }

  /**
   * Add a membership to a principal
   */
  addMembership(principalId: string, membership: string): void {
    const memberships = this.principalMemberships.get(principalId) || new Set();
    memberships.add(membership);
    this.principalMemberships.set(principalId, memberships);
  }

  /**
   * Remove a membership from a principal
   */
  removeMembership(principalId: string, membership: string): void {
    const memberships = this.principalMemberships.get(principalId);
    if (memberships) {
      memberships.delete(membership);
    }
  }

  /**
   * Check if a principal has permission to perform an action on an agent
   */
  check(request: PermissionCheckRequest): PermissionCheckResult {
    const { principal, action, agentId, context } = request;
    const config = this.permissions.get(agentId);

    // No permissions configured - deny by default
    if (!config) {
      return {
        allowed: false,
        reason: `No permissions configured for agent "${agentId}"`,
      };
    }

    // Owner has all permissions
    const principalString = `${principal.type}:${principal.id}`;
    if (config.owner === principalString || config.owner === principal.id) {
      return {
        allowed: true,
        reason: 'Principal is the owner',
      };
    }

    // Admin action requires owner
    if (action === 'admin') {
      return {
        allowed: false,
        reason: 'Only owner can perform admin actions',
      };
    }

    // Check if agent is public (anyone can read)
    if (action === 'read' && config.isPublic) {
      return {
        allowed: true,
        reason: 'Agent is public',
      };
    }

    // Get all principals that apply to this user (direct + memberships)
    const applicablePrincipals = this.getApplicablePrincipals(principal);

    // Find matching rule
    for (const rule of config.rules) {
      if (rule.action !== action) continue;

      // Check if any of the user's principals match the rule
      const matchingPrincipal = rule.principals.find(p => 
        applicablePrincipals.has(p)
      );

      if (matchingPrincipal) {
        // Check conditions if any
        if (rule.conditions && rule.conditions.length > 0) {
          const conditionResults = this.evaluateConditions(rule.conditions, context);
          const allPassed = conditionResults.every(r => r.passed);

          if (!allPassed) {
            return {
              allowed: false,
              reason: 'Permission conditions not met',
              matchedRule: rule,
              evaluatedConditions: conditionResults,
            };
          }
        }

        return {
          allowed: true,
          reason: `Matched rule for action "${action}" via principal "${matchingPrincipal}"`,
          matchedRule: rule,
        };
      }
    }

    // Check inherited permissions
    if (config.inheritFrom) {
      const inheritedResult = this.check({
        ...request,
        agentId: config.inheritFrom,
      });
      if (inheritedResult.allowed) {
        return {
          ...inheritedResult,
          reason: `Inherited from "${config.inheritFrom}": ${inheritedResult.reason}`,
        };
      }
    }

    return {
      allowed: false,
      reason: `No matching permission rule for action "${action}"`,
    };
  }

  /**
   * Check multiple permissions at once
   */
  checkMultiple(requests: PermissionCheckRequest[]): PermissionCheckResult[] {
    return requests.map(request => this.check(request));
  }

  /**
   * Grant a permission to principals for an agent
   */
  grant(agentId: string, action: PermissionAction, principals: string[]): void {
    const config = this.permissions.get(agentId);
    if (!config) {
      throw new OrkaError(
        `No permissions configured for agent "${agentId}"`,
        OrkaErrorCode.AGENT_NOT_FOUND,
        'PermissionManager'
      );
    }

    // Find existing rule for this action
    const existingRule = config.rules.find(r => r.action === action);
    if (existingRule) {
      // Add new principals to existing rule
      const newPrincipals = principals.filter(p => !existingRule.principals.includes(p));
      existingRule.principals.push(...newPrincipals);
    } else {
      // Create new rule
      config.rules.push({ action, principals });
    }
  }

  /**
   * Revoke a permission from principals for an agent
   */
  revoke(agentId: string, action: PermissionAction, principals: string[]): void {
    const config = this.permissions.get(agentId);
    if (!config) {
      throw new OrkaError(
        `No permissions configured for agent "${agentId}"`,
        OrkaErrorCode.AGENT_NOT_FOUND,
        'PermissionManager'
      );
    }

    const rule = config.rules.find(r => r.action === action);
    if (rule) {
      rule.principals = rule.principals.filter(p => !principals.includes(p));
      // Remove rule if no principals left
      if (rule.principals.length === 0) {
        config.rules = config.rules.filter(r => r.action !== action);
      }
    }
  }

  /**
   * Get all principals that apply to a user (direct + memberships)
   */
  private getApplicablePrincipals(principal: Principal): Set<string> {
    const principals = new Set<string>();

    // Add direct principal identifiers
    principals.add(`${principal.type}:${principal.id}`);
    principals.add(principal.id);

    // Add wildcard principals
    principals.add('*');
    principals.add(`${principal.type}:*`);

    // Add memberships (teams, roles)
    const memberships = this.principalMemberships.get(principal.id) || 
                        this.principalMemberships.get(`${principal.type}:${principal.id}`);
    if (memberships) {
      memberships.forEach(m => principals.add(m));
    }

    return principals;
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(
    conditions: PermissionCondition[],
    context?: Record<string, unknown>
  ): Array<{ condition: PermissionCondition; passed: boolean }> {
    return conditions.map(condition => {
      const passed = this.evaluateCondition(condition, context);
      return { condition, passed };
    });
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: PermissionCondition,
    context?: Record<string, unknown>
  ): boolean {
    switch (condition.type) {
      case 'time_range':
        return this.evaluateTimeRange(condition.config);
      case 'ip_whitelist':
        return this.evaluateIpWhitelist(condition.config, context);
      case 'rate_limit':
        return this.evaluateRateLimit(condition.config, context);
      case 'custom':
        return this.evaluateCustomCondition(condition.config, context);
      default:
        return true;
    }
  }

  /**
   * Evaluate time range condition
   */
  private evaluateTimeRange(config: Record<string, unknown>): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Check allowed hours
    if (config.allowedHours) {
      const { start, end } = config.allowedHours as { start: number; end: number };
      if (currentHour < start || currentHour >= end) {
        return false;
      }
    }

    // Check allowed days (0 = Sunday, 6 = Saturday)
    if (config.allowedDays) {
      const allowedDays = config.allowedDays as number[];
      if (!allowedDays.includes(currentDay)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate IP whitelist condition
   */
  private evaluateIpWhitelist(
    config: Record<string, unknown>,
    context?: Record<string, unknown>
  ): boolean {
    if (!context?.ipAddress) return true; // No IP to check
    
    const whitelist = config.ips as string[] | undefined;
    if (!whitelist || whitelist.length === 0) return true;

    const clientIp = context.ipAddress as string;
    return whitelist.some(ip => {
      if (ip.includes('/')) {
        // CIDR notation - simplified check
        return clientIp.startsWith(ip.split('/')[0].split('.').slice(0, 3).join('.'));
      }
      return ip === clientIp || ip === '*';
    });
  }

  /**
   * Evaluate rate limit condition (placeholder - needs external state)
   */
  private evaluateRateLimit(
    _config: Record<string, unknown>,
    _context?: Record<string, unknown>
  ): boolean {
    // Rate limiting requires external state management
    // This is a placeholder that always passes
    // In production, integrate with Redis or similar
    return true;
  }

  /**
   * Evaluate custom condition
   */
  private evaluateCustomCondition(
    config: Record<string, unknown>,
    context?: Record<string, unknown>
  ): boolean {
    // Custom conditions can be evaluated by checking context values
    if (config.check && typeof config.check === 'function') {
      return (config.check as (ctx: Record<string, unknown> | undefined) => boolean)(context);
    }
    return true;
  }

  /**
   * Export all permissions as JSON
   */
  export(): string {
    const data = Array.from(this.permissions.values());
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import permissions from JSON
   */
  import(json: string, overwrite = false): number {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) {
      throw new OrkaError(
        'Invalid import data: expected array',
        OrkaErrorCode.INVALID_INPUT,
        'PermissionManager'
      );
    }

    let imported = 0;
    for (const item of data) {
      const { agentId, ...rest } = item;
      if (!this.permissions.has(agentId) || overwrite) {
        this.permissions.set(agentId, { agentId, ...rest });
        imported++;
      }
    }
    return imported;
  }

  /**
   * Clear all permissions
   */
  clear(): void {
    this.permissions.clear();
    this.principalMemberships.clear();
  }

  /**
   * Get statistics about permissions
   */
  getStats(): {
    totalAgents: number;
    publicAgents: number;
    totalRules: number;
    actionCounts: Record<PermissionAction, number>;
  } {
    let publicAgents = 0;
    let totalRules = 0;
    const actionCounts: Record<string, number> = {};

    for (const config of this.permissions.values()) {
      if (config.isPublic) publicAgents++;
      totalRules += config.rules.length;
      
      for (const rule of config.rules) {
        actionCounts[rule.action] = (actionCounts[rule.action] || 0) + 1;
      }
    }

    return {
      totalAgents: this.permissions.size,
      publicAgents,
      totalRules,
      actionCounts: actionCounts as Record<PermissionAction, number>,
    };
  }
}

/**
 * Global permission manager instance
 */
export const globalPermissionManager = new PermissionManager();
