import type { PromptTemplateOptions } from './types.js';

export class PromptTemplate {
  private template: string;
  private inputVariables: string[];
  private partialVariables: Record<string, string | (() => string)>;

  constructor(options: PromptTemplateOptions) {
    this.template = options.template;
    this.inputVariables = options.inputVariables;
    this.partialVariables = options.partialVariables ?? {};

    if (options.validateTemplate !== false) {
      this.validate();
    }
  }

  static fromTemplate(template: string, partialVariables?: Record<string, string | (() => string)>): PromptTemplate {
    const variables = PromptTemplate.extractVariables(template);
    const partialKeys = Object.keys(partialVariables ?? {});
    const inputVariables = variables.filter(v => !partialKeys.includes(v));

    return new PromptTemplate({
      template,
      inputVariables,
      partialVariables,
    });
  }

  format(variables: Record<string, string>): string {
    const allVars = { ...this.resolvePartials(), ...variables };

    const missing = this.inputVariables.filter(v => !(v in allVars));
    if (missing.length > 0) {
      throw new Error(`Missing variables: ${missing.join(', ')}`);
    }

    let result = this.template;
    for (const [key, value] of Object.entries(allVars)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    }

    return result;
  }

  partial(variables: Record<string, string | (() => string)>): PromptTemplate {
    const newPartials = { ...this.partialVariables, ...variables };
    const partialKeys = Object.keys(newPartials);
    const remaining = this.inputVariables.filter(v => !partialKeys.includes(v));

    return new PromptTemplate({
      template: this.template,
      inputVariables: remaining,
      partialVariables: newPartials,
      validateTemplate: false,
    });
  }

  getInputVariables(): string[] {
    return [...this.inputVariables];
  }

  getTemplate(): string {
    return this.template;
  }

  private resolvePartials(): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.partialVariables)) {
      resolved[key] = typeof value === 'function' ? value() : value;
    }
    return resolved;
  }

  private validate(): void {
    const templateVars = PromptTemplate.extractVariables(this.template);
    const allDeclared = [...this.inputVariables, ...Object.keys(this.partialVariables)];

    for (const v of templateVars) {
      if (!allDeclared.includes(v)) {
        throw new Error(
          `Variable "{{${v}}}" found in template but not declared in inputVariables or partialVariables`
        );
      }
    }
  }

  static extractVariables(template: string): string[] {
    const matches = template.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
    const vars = new Set<string>();
    for (const match of matches) {
      vars.add(match[1]);
    }
    return [...vars];
  }
}
