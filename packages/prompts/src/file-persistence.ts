import type { PromptPersistence, PromptTemplate } from './types.js';

export class FilePromptPersistence implements PromptPersistence {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async save(prompts: Map<string, PromptTemplate[]>): Promise<void> {
    const fs = await import('fs/promises');
    const data: Record<string, PromptTemplate[]> = {};
    for (const [key, value] of prompts.entries()) {
      data[key] = value;
    }
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async load(): Promise<Map<string, PromptTemplate[]>> {
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content) as Record<string, PromptTemplate[]>;
      const map = new Map<string, PromptTemplate[]>();
      for (const [key, value] of Object.entries(data)) {
        map.set(key, value);
      }
      return map;
    } catch {
      return new Map();
    }
  }
}
