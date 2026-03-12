export interface PromptTemplate {
  id: string;
  version: number;
  name: string;
  template: string;
  variables: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  isActive: boolean;
}

export interface PromptRenderOptions {
  variables: Record<string, string>;
  version?: number;
}

export interface PromptDiff {
  fromVersion: number;
  toVersion: number;
  changes: PromptChange[];
}

export interface PromptChange {
  type: 'added' | 'removed' | 'modified';
  field: string;
  oldValue?: string;
  newValue?: string;
}

export interface PromptRegistryConfig {
  persistence?: PromptPersistence;
}

export interface PromptPersistence {
  save(prompts: Map<string, PromptTemplate[]>): Promise<void>;
  load(): Promise<Map<string, PromptTemplate[]>>;
}
