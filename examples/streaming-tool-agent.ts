/**
 * StreamingToolAgent example
 *
 * Demonstrates real-time streaming with tool execution.
 * The agent streams LLM tokens while tools run in parallel,
 * then continues streaming with the results.
 *
 * Prerequisites:
 *   OPENAI_API_KEY environment variable
 *
 * Run:
 *   npx tsx examples/streaming-tool-agent.ts
 */

import { StreamingToolAgent } from '@orka-js/agent';
import { OpenAIAdapter } from '@orka-js/openai';
import type { Tool } from '@orka-js/agent';

// ─── Mock tools ───────────────────────────────────────────────────────────────

const getWeatherTool: Tool = {
  name: 'get_weather',
  description: 'Get the current weather for a city.',
  parameters: [
    { name: 'city', type: 'string', description: 'City name', required: true },
  ],
  async execute({ city }) {
    // Replace with real API call in production
    const conditions: Record<string, string> = {
      Paris: 'Sunny, 18°C',
      London: 'Cloudy, 12°C',
      Tokyo: 'Rainy, 22°C',
    };
    return { output: conditions[city as string] ?? `Weather in ${city}: 20°C, partly cloudy` };
  },
};

const convertCurrencyTool: Tool = {
  name: 'convert_currency',
  description: 'Convert an amount from one currency to another.',
  parameters: [
    { name: 'amount', type: 'number', description: 'Amount to convert', required: true },
    { name: 'from', type: 'string', description: 'Source currency (e.g. USD)', required: true },
    { name: 'to', type: 'string', description: 'Target currency (e.g. EUR)', required: true },
  ],
  async execute({ amount, from, to }) {
    // Replace with real FX API in production
    const rate = from === 'USD' && to === 'EUR' ? 0.92 : 1.1;
    const converted = ((amount as number) * rate).toFixed(2);
    return { output: `${amount} ${from} = ${converted} ${to}` };
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const llm = new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
  });

  const agent = new StreamingToolAgent(
    {
      goal: 'Help users with weather and currency questions',
      tools: [getWeatherTool, convertCurrencyTool],
      verbose: true,
    },
    llm,
  );

  console.log('─── Streaming example ────────────────────────────────────────');
  console.log('Question: What is the weather in Paris, and how much is 100 USD in EUR?\n');

  for await (const event of agent.runStream(
    'What is the weather in Paris, and how much is 100 USD in EUR?',
  )) {
    switch (event.type) {
      case 'token':
        process.stdout.write(event.token);
        break;
      case 'tool_call':
        console.log(`\n[→ Tool call] ${event.name}(${event.arguments})`);
        break;
      case 'tool_result':
        console.log(`[← Tool result] ${event.result}`);
        break;
      case 'done':
        console.log('\n\n─── Final answer ─────────────────────────────────────────');
        console.log(event.content);
        break;
      case 'error':
        console.error('\n[Error]', event.message);
        break;
    }
  }

  console.log('\n─── Non-streaming example ────────────────────────────────────');
  const result = await agent.run('What is the weather in Tokyo?');
  console.log('Output:', result.output);
  console.log('Steps:', result.steps.length);
  console.log('Tokens:', result.totalTokens);
}

main().catch(console.error);
