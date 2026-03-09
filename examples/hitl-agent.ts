import { createOrka, OpenAIAdapter, MemoryVectorAdapter } from 'orkajs';
import { 
  HITLAgent, 
  MemoryCheckpointStore,
  type InterruptRequest,
  type InterruptResponse,
  type Tool,
} from 'orkajs/agent';
import * as readline from 'readline';

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });

const searchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true },
  ],
  execute: async (input) => {
    const query = input.query as string;
    return { output: `Search results for "${query}": [Mock results about ${query}]` };
  },
};

const sendEmailTool: Tool = {
  name: 'send_email',
  description: 'Send an email to a recipient',
  parameters: [
    { name: 'to', type: 'string', description: 'Recipient email', required: true },
    { name: 'subject', type: 'string', description: 'Email subject', required: true },
    { name: 'body', type: 'string', description: 'Email body', required: true },
  ],
  execute: async (input) => {
    return { output: `Email sent to ${input.to} with subject "${input.subject}"` };
  },
};

const deleteFileTool: Tool = {
  name: 'delete_file',
  description: 'Delete a file from the system',
  parameters: [
    { name: 'path', type: 'string', description: 'File path to delete', required: true },
  ],
  execute: async (input) => {
    return { output: `File ${input.path} deleted successfully` };
  },
};

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function interactiveInterruptHandler(request: InterruptRequest): Promise<InterruptResponse> {
  console.log('\n' + '='.repeat(60));
  console.log(`🔔 HUMAN APPROVAL REQUIRED`);
  console.log('='.repeat(60));
  console.log(`Reason: ${request.reason}`);
  console.log(`Message: ${request.message}`);
  
  if (request.data.toolName) {
    console.log(`Tool: ${request.data.toolName}`);
    console.log(`Input: ${JSON.stringify(request.data.toolInput, null, 2)}`);
  }
  
  if (request.data.thought) {
    console.log(`Agent's reasoning: ${request.data.thought}`);
  }
  
  console.log('='.repeat(60));

  const answer = await promptUser('Approve? (y/n/m for modify): ');

  if (answer.toLowerCase() === 'y') {
    return {
      id: request.id,
      status: 'approved',
      respondedAt: new Date(),
    };
  } else if (answer.toLowerCase() === 'm') {
    const newInput = await promptUser('Enter modified input (JSON): ');
    try {
      const modifiedInput = JSON.parse(newInput);
      return {
        id: request.id,
        status: 'modified',
        modifiedData: {
          toolName: request.data.toolName,
          toolInput: modifiedInput,
        },
        respondedAt: new Date(),
      };
    } catch {
      console.log('Invalid JSON, rejecting...');
      return {
        id: request.id,
        status: 'rejected',
        feedback: 'Invalid modification provided',
        respondedAt: new Date(),
      };
    }
  } else {
    const feedback = await promptUser('Reason for rejection (optional): ');
    return {
      id: request.id,
      status: 'rejected',
      feedback: feedback || 'Rejected by human reviewer',
      respondedAt: new Date(),
    };
  }
}

async function autoApproveHandler(request: InterruptRequest): Promise<InterruptResponse> {
  console.log(`[Auto] ${request.reason}: ${request.message}`);
  return {
    id: request.id,
    status: 'approved',
    respondedAt: new Date(),
  };
}

async function main() {
  console.log('🤖 Human-in-the-Loop Agent Demo\n');

  const checkpointStore = new MemoryCheckpointStore();

  const agent = new HITLAgent(
    {
      goal: 'Help the user with their tasks while requiring approval for sensitive operations',
      tools: [searchTool, sendEmailTool, deleteFileTool],
      verbose: true,
      hitl: {
        requireApprovalFor: ['send_email', 'delete_file'],
        autoApproveTools: ['web_search'],
        checkpointEvery: 2,
        defaultTimeoutMs: 60000,
        onInterrupt: interactiveInterruptHandler,
        checkpointStore,
      },
    },
    llm,
  );

  agent.on('step:start', (event) => {
    console.log(`\n📍 Starting step...`);
  });

  agent.on('tool:start', (event) => {
    console.log(`🔧 Executing tool: ${event.toolName}`);
  });

  agent.on('complete', (event) => {
    console.log(`\n✅ Agent completed!`);
  });

  const result = await agent.run(
    'Search for the latest news about AI, then send a summary email to team@example.com'
  );

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL RESULT');
  console.log('='.repeat(60));
  console.log(`Output: ${result.output}`);
  console.log(`Steps: ${result.steps.length}`);
  console.log(`Tools used: ${result.toolsUsed.join(', ')}`);
  console.log(`Was interrupted: ${result.wasInterrupted}`);
  console.log(`Interrupts: ${result.interrupts.length}`);
  console.log(`Checkpoints: ${result.checkpoints.length}`);
  console.log(`Total latency: ${result.totalLatencyMs}ms`);

  const checkpoints = await agent.getCheckpoints();
  if (checkpoints.length > 0) {
    console.log('\n📸 Checkpoints saved:');
    for (const cp of checkpoints) {
      console.log(`  - ${cp.id} (step ${cp.stepNumber})`);
    }
  }
}

main().catch(console.error);
