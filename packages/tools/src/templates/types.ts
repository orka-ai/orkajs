export interface PromptTemplateOptions {
  template: string;
  inputVariables: string[];
  partialVariables?: Record<string, string | (() => string)>;
  validateTemplate?: boolean;
}

export interface ChatPromptTemplateOptions {
  messages: ChatMessageTemplate[];
  inputVariables?: string[];
  partialVariables?: Record<string, string | (() => string)>;
}

export interface ChatMessageTemplate {
  role: 'system' | 'user' | 'assistant';
  template: string;
}

export interface FewShotPromptTemplateOptions {
  examples: FewShotExample[];
  examplePrompt: string;
  prefix?: string;
  suffix: string;
  inputVariables: string[];
  exampleSeparator?: string;
  partialVariables?: Record<string, string | (() => string)>;
}

export interface FewShotExample {
  [key: string]: string;
}

export interface PipelinePromptTemplateOptions {
  finalPrompt: string;
  pipelinePrompts: PipelineStep[];
  inputVariables: string[];
}

export interface PipelineStep {
  name: string;
  template: string;
}
