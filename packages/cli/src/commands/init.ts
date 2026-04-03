import { intro, outro, select, text, confirm, spinner, log } from '@clack/prompts';
import { join } from 'path';
import fs from 'fs-extra';

const TEMPLATES: Record<string, { description: string; files: Record<string, string> }> = {
  basic: {
    description: 'Simple agent with a goal and optional tools',
    files: {
      'src/agent.ts': `import { StreamingToolAgent } from '@orka-js/agent';
import { OpenAIAdapter } from '@orka-js/openai';

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });

export const agent = new StreamingToolAgent({
  goal: 'You are a helpful assistant.',
}, llm);
`,
      'src/index.ts': `import { agent } from './agent.js';

const input = process.argv[2] ?? 'Hello!';

for await (const event of agent.runStream(input)) {
  if (event.type === 'token') process.stdout.write(event.token);
  if (event.type === 'done') console.log('\\n\\nDone!');
}
`,
    },
  },

  rag: {
    description: 'RAG pipeline with vector search and document loading',
    files: {
      'src/agent.ts': `import { StreamingToolAgent } from '@orka-js/agent';
import { OpenAIAdapter } from '@orka-js/openai';
import { InMemoryVectorStore } from '@orka-js/memory';

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });
const vectorStore = new InMemoryVectorStore({ llm });

export const searchTool = {
  name: 'search_docs',
  description: 'Search the knowledge base for relevant documents',
  parameters: [{ name: 'query', type: 'string', description: 'Search query', required: true }],
  execute: async ({ query }: { query: string }) => {
    const results = await vectorStore.similaritySearch(query, { topK: 3 });
    return results.map(r => r.content).join('\\n---\\n');
  },
};

export const agent = new StreamingToolAgent({
  goal: 'Answer questions using the knowledge base. Always search before answering.',
  tools: [searchTool],
}, llm);
`,
      'src/ingest.ts': `import { InMemoryVectorStore } from '@orka-js/memory';
import { OpenAIAdapter } from '@orka-js/openai';

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });
const vectorStore = new InMemoryVectorStore({ llm });

// Add your documents here
await vectorStore.add([
  { id: '1', content: 'OrkaJS is a TypeScript AI agent framework.', metadata: {} },
  { id: '2', content: 'OrkaJS supports streaming, tools, memory, and graph workflows.', metadata: {} },
]);

console.log('Documents ingested!');
`,
    },
  },

  sales: {
    description: 'Sales agent with tools and durable job persistence',
    files: {
      'src/agent.ts': `import { StreamingToolAgent } from '@orka-js/agent';
import { DurableAgent, MemoryDurableStore } from '@orka-js/durable';
import { OpenAIAdapter } from '@orka-js/openai';

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });
const store = new MemoryDurableStore();

const tools = [
  {
    name: 'search_company',
    description: 'Look up company information',
    parameters: [{ name: 'name', type: 'string', description: 'Company name', required: true }],
    execute: async ({ name }: { name: string }) => \`Company: \${name} — 500 employees, SaaS.\`,
  },
  {
    name: 'send_email',
    description: 'Send a prospecting email',
    parameters: [
      { name: 'to', type: 'string', description: 'Email address', required: true },
      { name: 'subject', type: 'string', description: 'Email subject', required: true },
      { name: 'body', type: 'string', description: 'Email body', required: true },
    ],
    execute: async ({ to, subject }: { to: string; subject: string }) => \`Email sent to \${to}: \${subject}\`,
  },
];

const innerAgent = new StreamingToolAgent({ goal: 'You are a B2B sales agent.', tools }, llm);
export const durableAgent = new DurableAgent(innerAgent, store);
`,
    },
  },
};

export async function runInit(targetDir?: string) {
  intro('Orka Init — Create a new OrkaJS project');

  const dir = targetDir ?? (await text({
    message: 'Project directory:',
    placeholder: './my-orka-agent',
    defaultValue: './my-orka-agent',
  })) as string;

  if (!dir) { log.error('No directory specified.'); process.exit(1); }

  const template = await select({
    message: 'Choose a template:',
    options: Object.entries(TEMPLATES).map(([value, t]) => ({
      value,
      label: value,
      hint: t.description,
    })),
  }) as string;

  const provider = await select({
    message: 'LLM provider:',
    options: [
      { value: 'openai', label: 'OpenAI', hint: 'GPT-4o, GPT-4-turbo' },
      { value: 'anthropic', label: 'Anthropic', hint: 'Claude 3.5, Claude 4' },
      { value: 'google', label: 'Google', hint: 'Gemini 2.0 Flash' },
      { value: 'ollama', label: 'Ollama', hint: 'Local models' },
    ],
  }) as string;

  const install = await confirm({ message: 'Install dependencies?' });

  const s = spinner();
  s.start('Creating project files…');

  const fullDir = join(process.cwd(), dir);
  await fs.ensureDir(fullDir);
  await fs.ensureDir(join(fullDir, 'src'));

  const tpl = TEMPLATES[template];
  for (const [file, content] of Object.entries(tpl.files)) {
    await fs.outputFile(join(fullDir, file), content);
  }

  // package.json
  const pkgDeps: Record<string, string> = {
    '@orka-js/agent': '^1.5.0',
    '@orka-js/core': '^1.5.0',
  };
  if (provider !== 'ollama') pkgDeps[`@orka-js/${provider}`] = '^1.5.0';
  if (provider === 'ollama') pkgDeps['@orka-js/ollama'] = '^1.5.0';
  if (template === 'rag') pkgDeps['@orka-js/memory'] = '^1.5.0';
  if (template === 'sales') pkgDeps['@orka-js/durable'] = '^1.5.0';

  await fs.outputJSON(join(fullDir, 'package.json'), {
    name: dir.replace('./', '').replace(/\//g, '-'),
    version: '0.1.0',
    type: 'module',
    scripts: { dev: 'node --loader ts-node/esm src/index.ts', build: 'tsc' },
    dependencies: pkgDeps,
    devDependencies: { typescript: '^5.4.0', 'ts-node': '^10.9.2' },
  }, { spaces: 2 });

  // .env.example
  const envVars = provider !== 'ollama' ? `${provider.toUpperCase()}_API_KEY=your-api-key-here\n` : '';
  await fs.outputFile(join(fullDir, '.env.example'), envVars);

  // .gitignore
  await fs.outputFile(join(fullDir, '.gitignore'), 'node_modules\ndist\n.env\n');

  s.stop('Project files created!');

  if (install) {
    const s2 = spinner();
    s2.start('Installing dependencies…');
    const { execSync } = await import('child_process');
    try {
      execSync('npm install', { cwd: fullDir, stdio: 'pipe' });
      s2.stop('Dependencies installed!');
    } catch {
      s2.stop('Install failed — run npm install manually.');
    }
  }

  outro(`Done! \`cd ${dir}\` and add your API key to .env`);
}
