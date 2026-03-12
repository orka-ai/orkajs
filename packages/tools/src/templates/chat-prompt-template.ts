import type { ChatMessage } from '@orkajs/core';
import type { ChatPromptTemplateOptions, ChatMessageTemplate } from './types.js';
import { PromptTemplate } from './prompt-template.js';

export class ChatPromptTemplate {
  private messageTemplates: ChatMessageTemplate[];
  private inputVariables: string[];
  private partialVariables: Record<string, string | (() => string)>;

  constructor(options: ChatPromptTemplateOptions) {
    this.messageTemplates = options.messages;
    this.partialVariables = options.partialVariables ?? {};

    if (options.inputVariables) {
      this.inputVariables = options.inputVariables;
    } else {
      const allVars = new Set<string>();
      for (const msg of this.messageTemplates) {
        for (const v of PromptTemplate.extractVariables(msg.template)) {
          allVars.add(v);
        }
      }
      for (const key of Object.keys(this.partialVariables)) {
        allVars.delete(key);
      }
      this.inputVariables = [...allVars];
    }
  }

  static fromMessages(
    messages: Array<[role: 'system' | 'user' | 'assistant', template: string]>,
    partialVariables?: Record<string, string | (() => string)>
  ): ChatPromptTemplate {
    return new ChatPromptTemplate({
      messages: messages.map(([role, template]) => ({ role, template })),
      partialVariables,
    });
  }

  format(variables: Record<string, string>): ChatMessage[] {
    const allVars = { ...this.resolvePartials(), ...variables };

    const missing = this.inputVariables.filter(v => !(v in allVars));
    if (missing.length > 0) {
      throw new Error(`Missing variables: ${missing.join(', ')}`);
    }

    return this.messageTemplates.map(msg => {
      let content = msg.template;
      for (const [key, value] of Object.entries(allVars)) {
        content = content.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
      }
      return { role: msg.role, content };
    });
  }

  formatAsString(variables: Record<string, string>): string {
    const messages = this.format(variables);
    return messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n\n');
  }

  partial(variables: Record<string, string | (() => string)>): ChatPromptTemplate {
    const newPartials = { ...this.partialVariables, ...variables };
    const partialKeys = Object.keys(newPartials);
    const remaining = this.inputVariables.filter(v => !partialKeys.includes(v));

    return new ChatPromptTemplate({
      messages: this.messageTemplates,
      inputVariables: remaining,
      partialVariables: newPartials,
    });
  }

  getInputVariables(): string[] {
    return [...this.inputVariables];
  }

  private resolvePartials(): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.partialVariables)) {
      resolved[key] = typeof value === 'function' ? value() : value;
    }
    return resolved;
  }
}
