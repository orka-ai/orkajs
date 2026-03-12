import type { FewShotPromptTemplateOptions, FewShotExample } from './types.js';
import { PromptTemplate } from './prompt-template.js';

export class FewShotPromptTemplate {
  private examples: FewShotExample[];
  private examplePrompt: PromptTemplate;
  private prefix: string;
  private suffix: string;
  private inputVariables: string[];
  private exampleSeparator: string;
  private partialVariables: Record<string, string | (() => string)>;

  constructor(options: FewShotPromptTemplateOptions) {
    this.examples = options.examples;
    this.prefix = options.prefix ?? '';
    this.suffix = options.suffix;
    this.inputVariables = options.inputVariables;
    this.exampleSeparator = options.exampleSeparator ?? '\n\n';
    this.partialVariables = options.partialVariables ?? {};

    const exampleVars = PromptTemplate.extractVariables(options.examplePrompt);
    this.examplePrompt = new PromptTemplate({
      template: options.examplePrompt,
      inputVariables: exampleVars,
      validateTemplate: false,
    });
  }

  format(variables: Record<string, string>): string {
    const allVars = { ...this.resolvePartials(), ...variables };

    const missing = this.inputVariables.filter(v => !(v in allVars));
    if (missing.length > 0) {
      throw new Error(`Missing variables: ${missing.join(', ')}`);
    }

    // Format examples
    const formattedExamples = this.examples.map(example =>
      this.examplePrompt.format(example)
    );

    // Build the full prompt
    const parts: string[] = [];

    if (this.prefix) {
      let prefix = this.prefix;
      for (const [key, value] of Object.entries(allVars)) {
        prefix = prefix.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
      }
      parts.push(prefix);
    }

    parts.push(formattedExamples.join(this.exampleSeparator));

    let suffix = this.suffix;
    for (const [key, value] of Object.entries(allVars)) {
      suffix = suffix.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    }
    parts.push(suffix);

    return parts.join(this.exampleSeparator);
  }

  addExample(example: FewShotExample): void {
    this.examples.push(example);
  }

  addExamples(examples: FewShotExample[]): void {
    this.examples.push(...examples);
  }

  getExamples(): FewShotExample[] {
    return [...this.examples];
  }

  getInputVariables(): string[] {
    return [...this.inputVariables];
  }

  partial(variables: Record<string, string | (() => string)>): FewShotPromptTemplate {
    const newPartials = { ...this.partialVariables, ...variables };
    const partialKeys = Object.keys(newPartials);
    const remaining = this.inputVariables.filter(v => !partialKeys.includes(v));

    return new FewShotPromptTemplate({
      examples: this.examples,
      examplePrompt: this.examplePrompt.getTemplate(),
      prefix: this.prefix,
      suffix: this.suffix,
      inputVariables: remaining,
      exampleSeparator: this.exampleSeparator,
      partialVariables: newPartials,
    });
  }

  private resolvePartials(): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.partialVariables)) {
      resolved[key] = typeof value === 'function' ? value() : value;
    }
    return resolved;
  }
}
