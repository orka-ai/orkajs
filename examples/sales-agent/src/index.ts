/**
 * Sales Agent example with DurableAgent.
 *
 * Demonstrates: DurableAgent + StreamingToolAgent + tools + job persistence
 *
 * Usage:
 *   OPENAI_API_KEY=... pnpm start "Research Acme Corp and send them a prospecting email"
 */
import { StreamingToolAgent } from '@orka-js/agent';
import { DurableAgent, MemoryDurableStore } from '@orka-js/durable';
import { OpenAIAdapter } from '@orka-js/openai';
import { searchCompanyTool, sendEmailTool, scheduleDemoTool } from './tools.js';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('OPENAI_API_KEY is required'); process.exit(1); }

const llm = new OpenAIAdapter({ apiKey, model: 'gpt-4o-mini' });
const store = new MemoryDurableStore();

const innerAgent = new StreamingToolAgent({
  goal: 'You are a B2B sales agent. Research prospects, craft personalized outreach, and schedule demos.',
  tools: [searchCompanyTool, sendEmailTool, scheduleDemoTool],
}, llm);

const agent = new DurableAgent(innerAgent, store, {
  maxRetries: 3,
  retryDelayMs: 1000,
});

const jobId = `job-${Date.now()}`;
const input = process.argv[2] ?? 'Research Acme Corp and send them a prospecting email to ceo@acme.com';

console.log(`Job ID: ${jobId}`);
console.log(`Input: ${input}\n`);

// Stream the agent execution
for await (const event of agent.runStream(jobId, input)) {
  if (event.type === 'token') {
    process.stdout.write(event.token);
  } else if (event.type === 'tool_call') {
    process.stderr.write(`\n[Tool: ${event.toolName}]\n`);
  } else if (event.type === 'done') {
    console.log('\n\nJob completed!');
  } else if (event.type === 'error') {
    console.error('\nError:', event.message);
  }
}

// Show job status
const status = await agent.status(jobId);
console.log(`\nFinal status: ${status?.status}`);
console.log('All jobs:', (await agent.list()).map(j => `${j.id}: ${j.status}`));
