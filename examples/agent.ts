import {
  createOrka,
  OpenAIAdapter,
  MemoryVectorAdapter,
  type Tool,
} from '../src/index.js';



// Define tools
const getOrderTool: Tool = {
  name: 'get_order',
  description: 'Retrieve order information by ID',
  parameters: [
    { name: 'orderId', type: 'string', description: 'The order ID', required: true },
  ],
  async execute(input) {
    const orderId = input.orderId as string;
    // Simulation of an API call
    const orders: Record<string, { status: string; total: string; date: string }> = {
      'ORD-001': { status: 'Delivered', total: '59.99€', date: '2025-02-10' },
      'ORD-002': { status: 'In transit', total: '129.00€', date: '2025-02-15' },
      'ORD-003': { status: 'In preparation', total: '34.50€', date: '2025-02-17' },
    };
    const order = orders[orderId];
    if (!order) {
      return { output: `Command ${orderId} not found.` };
    }
    return { output: `Command ${orderId}: status=${order.status}, total=${order.total}, date=${order.date}` };
  },
};

const refundTool: Tool = {
  name: 'request_refund',
  description: 'Request a refund for an order',
  parameters: [
    { name: 'orderId', type: 'string', description: 'The order ID', required: true },
    { name: 'reason', type: 'string', description: 'Reason for the refund', required: true },
  ],
  async execute(input) {
    const orderId = input.orderId as string;
    const reason = input.reason as string;
    return {
      output: `Refund requested for ${orderId}. Reason: ${reason}. Processing within 5 business days. Reference: REF-${Date.now()}`
    };
  },
};

const searchFaqTool: Tool = {
  name: 'search_faq',
  description: 'Search the FAQ to find answers',
  parameters: [
    { name: 'query', type: 'string', description: 'The question to search for', required: true },
  ],
  async execute(input) {
    const query = (input.query as string).toLowerCase();
    const faq: Record<string, string> = {
      'refund': 'Refunds are processed within 5 business days.',
      'delivery': 'Standard delivery takes 3-5 days. Express: 24h.',
      'return': 'You have 30 days to return an item.',
    };
    for (const [key, answer] of Object.entries(faq)) {
      if (query.includes(key)) {
        return { output: answer };
      }
    }
    return { output: 'No answer found in the FAQ.' };
  },
};

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    vectorDB: new MemoryVectorAdapter(),
  });

  // Create an agent with tools and policy
  const supportAgent = orka.agent({
    goal: 'Helping customers with their orders and questions',
    tools: [getOrderTool, refundTool, searchFaqTool],
    policy: {
      maxSteps: 5,
      noHallucination: true,
      rules: [
        'Always check the order before proposing a refund',
        'Be professional and empathetic',
        'Never make up information',
      ],
    },
    temperature: 0.3,
  });

  console.log('🤖 Agent: Support Client\n');

  // Scenario 1: Check order status
  console.log('--- Scenario 1: Order status ---');
  const result1 = await supportAgent.run('What is the status of my order ORD-002?');
  console.log(`Response: ${result1.output}`);
  console.log(`Steps: ${result1.steps.length}, Tools: ${result1.toolsUsed.join(', ')}\n`);

  // Scenario 2: FAQ question
  console.log('--- Scenario 2: FAQ question ---');
  const result2 = await supportAgent.run('What is the delivery time?');
  console.log(`Response: ${result2.output}`);
  console.log(`Steps: ${result2.steps.length}, Tools: ${result2.toolsUsed.join(', ')}\n`);
}

main().catch(console.error);
