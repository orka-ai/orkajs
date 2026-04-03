/**
 * Sales Agent HTTP server example.
 *
 * Demonstrates: @orka-js/express middleware exposing the DurableAgent
 *
 * Usage:
 *   OPENAI_API_KEY=... pnpm server
 *   curl -X POST http://localhost:3000/sales-agent/stream \
 *     -H 'Content-Type: application/json' \
 *     -d '{"input":"Research Acme Corp"}'
 */
import express from 'express';
import { StreamingToolAgent } from '@orka-js/agent';
import { OpenAIAdapter } from '@orka-js/openai';
import { orkaMiddleware } from '@orka-js/express';
import { searchCompanyTool, sendEmailTool, scheduleDemoTool } from './tools.js';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('OPENAI_API_KEY is required'); process.exit(1); }

const llm = new OpenAIAdapter({ apiKey, model: 'gpt-4o-mini' });

const salesAgent = new StreamingToolAgent({
  goal: 'You are a B2B sales agent. Research prospects and craft personalized outreach.',
  tools: [searchCompanyTool, sendEmailTool, scheduleDemoTool],
}, llm);

const app = express();
app.use(express.json());

// Mount the Orka middleware — exposes /sales-agent, /sales-agent/stream, etc.
app.use(orkaMiddleware({
  agents: { 'sales-agent': salesAgent },
}));

app.listen(3000, () => {
  console.log('Sales agent server running at http://localhost:3000');
  console.log('Endpoints:');
  console.log('  GET  / — list agents');
  console.log('  POST /sales-agent — run (blocking)');
  console.log('  POST /sales-agent/stream — stream (SSE)');
});
