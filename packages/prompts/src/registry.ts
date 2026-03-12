import type { 
  PromptTemplate, 
  PromptRenderOptions, 
  PromptDiff, 
  PromptChange,
  PromptRegistryConfig,
  PromptPersistence,
} from './types.js';
import { generateId } from '@orka-js/core';

export class PromptRegistry {
  private prompts: Map<string, PromptTemplate[]> = new Map();
  private persistence?: PromptPersistence;

  constructor(config: PromptRegistryConfig = {}) {
    this.persistence = config.persistence;
  }

  async load(): Promise<void> {
    if (this.persistence) {
      this.prompts = await this.persistence.load();
    }
  }

  async save(): Promise<void> {
    if (this.persistence) {
      await this.persistence.save(this.prompts);
    }
  }

  register(name: string, template: string, metadata?: Record<string, unknown>): PromptTemplate {
    const variables = this.extractVariables(template);
    const versions = this.prompts.get(name) ?? [];

    for (const v of versions) {
      v.isActive = false;
    }

    const newVersion: PromptTemplate = {
      id: generateId(),
      version: versions.length + 1,
      name,
      template,
      variables,
      metadata,
      createdAt: Date.now(),
      isActive: true,
    };

    versions.push(newVersion);
    this.prompts.set(name, versions);

    return newVersion;
  }

  get(name: string, version?: number): PromptTemplate | undefined {
    const versions = this.prompts.get(name);
    if (!versions || versions.length === 0) return undefined;

    if (version !== undefined) {
      return versions.find(v => v.version === version);
    }

    return versions.find(v => v.isActive) ?? versions[versions.length - 1];
  }

  render(name: string, options: PromptRenderOptions): string {
    const template = this.get(name, options.version);
    if (!template) {
      throw new Error(`Prompt "${name}" not found`);
    }

    let result = template.template;
    for (const [key, value] of Object.entries(options.variables)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    }

    const missing = this.extractVariables(result);
    if (missing.length > 0) {
      throw new Error(`Missing variables in prompt "${name}": ${missing.join(', ')}`);
    }

    return result;
  }

  getVersions(name: string): PromptTemplate[] {
    return [...(this.prompts.get(name) ?? [])];
  }

  getActiveVersion(name: string): number | undefined {
    const versions = this.prompts.get(name);
    if (!versions) return undefined;
    return versions.find(v => v.isActive)?.version;
  }

  setActive(name: string, version: number): void {
    const versions = this.prompts.get(name);
    if (!versions) throw new Error(`Prompt "${name}" not found`);

    const target = versions.find(v => v.version === version);
    if (!target) throw new Error(`Version ${version} of prompt "${name}" not found`);

    for (const v of versions) {
      v.isActive = false;
    }
    target.isActive = true;
  }

  rollback(name: string): PromptTemplate | undefined {
    const versions = this.prompts.get(name);
    if (!versions || versions.length < 2) return undefined;

    const activeIdx = versions.findIndex(v => v.isActive);
    if (activeIdx <= 0) return undefined;

    versions[activeIdx].isActive = false;
    versions[activeIdx - 1].isActive = true;

    return versions[activeIdx - 1];
  }

  diff(name: string, fromVersion: number, toVersion: number): PromptDiff {
    const from = this.get(name, fromVersion);
    const to = this.get(name, toVersion);

    if (!from) throw new Error(`Version ${fromVersion} of prompt "${name}" not found`);
    if (!to) throw new Error(`Version ${toVersion} of prompt "${name}" not found`);

    const changes: PromptChange[] = [];

    if (from.template !== to.template) {
      changes.push({
        type: 'modified',
        field: 'template',
        oldValue: from.template,
        newValue: to.template,
      });
    }

    const addedVars = to.variables.filter(v => !from.variables.includes(v));
    const removedVars = from.variables.filter(v => !to.variables.includes(v));

    for (const v of addedVars) {
      changes.push({ type: 'added', field: 'variable', newValue: v });
    }
    for (const v of removedVars) {
      changes.push({ type: 'removed', field: 'variable', oldValue: v });
    }

    return { fromVersion, toVersion, changes };
  }

  list(): string[] {
    return [...this.prompts.keys()];
  }

  delete(name: string): boolean {
    return this.prompts.delete(name);
  }

  private extractVariables(template: string): string[] {
    const matches = template.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
    const vars = new Set<string>();
    for (const match of matches) {
      vars.add(match[1]);
    }
    return [...vars];
  }
}
