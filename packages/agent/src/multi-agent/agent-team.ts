import { generateId } from '@orka-js/core';
import type { LLMAdapter } from '@orka-js/core';
import type {
  AgentRole,
  AgentMessage,
  AgentState,
  AgentTeamConfig,
  TeamTask,
  TeamResult,
  AgentContribution,
  TeamEvent,
  CollaborationStrategy,
} from './types.js';

/**
 * AgentTeam - Orchestrates multiple agents working together
 */
export class AgentTeam {
  readonly name: string;
  private strategy: CollaborationStrategy;
  private agents: Map<string, AgentState> = new Map();
  private llm: LLMAdapter;
  private supervisor?: string;
  private maxRounds: number;
  readonly consensusThreshold: number;
  private messageHistory: AgentMessage[] = [];

  constructor(config: AgentTeamConfig) {
    this.name = config.name;
    this.strategy = config.strategy;
    this.llm = config.llm;
    this.supervisor = config.supervisor;
    this.maxRounds = config.maxRounds ?? 10;
    this.consensusThreshold = config.consensusThreshold ?? 0.7;

    // Initialize agents
    for (const role of config.agents) {
      const agentId = role.name.toLowerCase().replace(/\s+/g, '_');
      this.agents.set(agentId, {
        agentId,
        role,
        status: 'idle',
        messages: [],
        results: [],
      });
    }

    // Validate supervisor exists
    if (this.strategy === 'supervisor' && this.supervisor) {
      if (!this.agents.has(this.supervisor)) {
        throw new Error(`Supervisor agent "${this.supervisor}" not found`);
      }
    }
  }

  /**
   * Execute a task with the agent team
   */
  async execute(task: TeamTask): Promise<TeamResult> {
    const startTime = Date.now();
    const contributions: AgentContribution[] = [];
    let rounds = 0;

    // Reset agent states
    for (const [, agent] of this.agents) {
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.messages = [];
      agent.results = [];
    }
    this.messageHistory = [];

    try {
      let output: string;

      switch (this.strategy) {
        case 'supervisor':
          output = await this.executeSupervisorStrategy(task, contributions);
          break;
        case 'peer-to-peer':
          output = await this.executePeerToPeerStrategy(task, contributions);
          break;
        case 'round-robin':
          output = await this.executeRoundRobinStrategy(task, contributions);
          break;
        case 'consensus':
          output = await this.executeConsensusStrategy(task, contributions);
          break;
        case 'hierarchical':
          output = await this.executeHierarchicalStrategy(task, contributions);
          break;
        default:
          throw new Error(`Unknown strategy: ${this.strategy}`);
      }

      rounds = Math.ceil(this.messageHistory.length / this.agents.size);

      return {
        taskId: task.id,
        success: true,
        output,
        agentContributions: contributions,
        messages: this.messageHistory,
        rounds,
        totalLatencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        output: (error as Error).message,
        agentContributions: contributions,
        messages: this.messageHistory,
        rounds,
        totalLatencyMs: Date.now() - startTime,
        metadata: { error: (error as Error).message },
      };
    }
  }

  /**
   * Stream execution events
   */
  async *stream(task: TeamTask): AsyncIterable<TeamEvent> {
    yield {
      type: 'task_started',
      timestamp: Date.now(),
      metadata: { taskId: task.id, description: task.description },
    };

    // Reset and start
    for (const [agentId, agent] of this.agents) {
      agent.status = 'idle';
      yield {
        type: 'agent_assigned',
        agentId,
        state: { ...agent },
        timestamp: Date.now(),
      };
    }

    // Execute based on strategy (simplified streaming)
    const result = await this.execute(task);

    for (const message of result.messages) {
      yield {
        type: 'message_sent',
        agentId: message.from,
        message,
        timestamp: message.timestamp,
      };
    }

    yield {
      type: 'task_completed',
      timestamp: Date.now(),
      metadata: {
        success: result.success,
        output: result.output,
        rounds: result.rounds,
      },
    };
  }

  /**
   * Supervisor strategy - one agent coordinates others
   */
  private async executeSupervisorStrategy(
    task: TeamTask,
    contributions: AgentContribution[]
  ): Promise<string> {
    if (!this.supervisor) {
      throw new Error('Supervisor not configured');
    }

    const supervisorAgent = this.agents.get(this.supervisor)!;
    const workerAgents = Array.from(this.agents.entries())
      .filter(([id]) => id !== this.supervisor);

    // Supervisor plans the work
    const planPrompt = this.buildSupervisorPlanPrompt(task, workerAgents.map(([, a]) => a.role));
    const planResponse = await this.runAgent(supervisorAgent, planPrompt);
    
    contributions.push({
      agentId: this.supervisor,
      role: supervisorAgent.role.name,
      actions: ['plan'],
      output: planResponse,
      latencyMs: 0,
    });

    // Parse assignments and delegate
    const assignments = this.parseAssignments(planResponse, workerAgents.map(([id]) => id));
    const workerResults: string[] = [];

    for (const [agentId, subtask] of Object.entries(assignments)) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      const startTime = Date.now();
      const result = await this.runAgent(agent, subtask);
      workerResults.push(`${agent.role.name}: ${result}`);

      contributions.push({
        agentId,
        role: agent.role.name,
        actions: ['execute'],
        output: result,
        latencyMs: Date.now() - startTime,
      });

      // Send result to supervisor
      this.sendMessage(agentId, this.supervisor, result, 'report');
    }

    // Supervisor synthesizes results
    const synthesisPrompt = this.buildSynthesisPrompt(task, workerResults);
    const finalOutput = await this.runAgent(supervisorAgent, synthesisPrompt);

    return finalOutput;
  }

  /**
   * Peer-to-peer strategy - agents communicate directly
   */
  private async executePeerToPeerStrategy(
    task: TeamTask,
    contributions: AgentContribution[]
  ): Promise<string> {
    const agentList = Array.from(this.agents.values());
    const results: string[] = [];

    // Each agent works on the task
    for (const agent of agentList) {
      const startTime = Date.now();
      
      // Include messages from other agents
      const context = this.messageHistory
        .filter(m => m.to === agent.agentId || m.to === 'broadcast')
        .map(m => `${m.from}: ${m.content}`)
        .join('\n');

      const prompt = context
        ? `Previous discussion:\n${context}\n\nTask: ${task.description}\n\nYour contribution:`
        : `Task: ${task.description}\n\nYour contribution:`;

      const result = await this.runAgent(agent, prompt);
      results.push(result);

      // Broadcast to other agents
      this.sendMessage(agent.agentId, 'broadcast', result, 'broadcast');

      contributions.push({
        agentId: agent.agentId,
        role: agent.role.name,
        actions: ['contribute'],
        output: result,
        latencyMs: Date.now() - startTime,
      });
    }

    // Synthesize all contributions
    return this.synthesizeResults(task, results);
  }

  /**
   * Round-robin strategy - agents take turns
   */
  private async executeRoundRobinStrategy(
    task: TeamTask,
    contributions: AgentContribution[]
  ): Promise<string> {
    const agentList = Array.from(this.agents.values());
    let currentOutput = '';
    let round = 0;

    while (round < this.maxRounds) {
      for (const agent of agentList) {
        const startTime = Date.now();

        const prompt = currentOutput
          ? `Task: ${task.description}\n\nPrevious work:\n${currentOutput}\n\nContinue or improve:`
          : `Task: ${task.description}\n\nStart working:`;

        const result = await this.runAgent(agent, prompt);
        currentOutput = result;

        contributions.push({
          agentId: agent.agentId,
          role: agent.role.name,
          actions: [`round_${round}`],
          output: result,
          latencyMs: Date.now() - startTime,
        });

        // Check if task is complete
        if (await this.isTaskComplete(task, currentOutput)) {
          return currentOutput;
        }
      }
      round++;
    }

    return currentOutput;
  }

  /**
   * Consensus strategy - agents must agree
   */
  private async executeConsensusStrategy(
    task: TeamTask,
    contributions: AgentContribution[]
  ): Promise<string> {
    const agentList = Array.from(this.agents.values());
    let round = 0;
    let consensus = false;
    let proposals: Map<string, string> = new Map();

    while (!consensus && round < this.maxRounds) {
      proposals.clear();

      // Each agent proposes a solution
      for (const agent of agentList) {
        const startTime = Date.now();

        const previousProposals = round > 0
          ? Array.from(proposals.entries())
              .map(([id, p]) => `${id}: ${p}`)
              .join('\n')
          : '';

        const prompt = previousProposals
          ? `Task: ${task.description}\n\nPrevious proposals:\n${previousProposals}\n\nYour proposal (try to find common ground):`
          : `Task: ${task.description}\n\nYour proposal:`;

        const result = await this.runAgent(agent, prompt);
        proposals.set(agent.agentId, result);

        contributions.push({
          agentId: agent.agentId,
          role: agent.role.name,
          actions: [`propose_round_${round}`],
          output: result,
          latencyMs: Date.now() - startTime,
        });
      }

      // Check for consensus
      consensus = await this.checkConsensus(Array.from(proposals.values()));
      round++;
    }

    // Return the most agreed-upon proposal or synthesize
    if (consensus) {
      return Array.from(proposals.values())[0];
    }

    return this.synthesizeResults(task, Array.from(proposals.values()));
  }

  /**
   * Hierarchical strategy - tree structure
   */
  private async executeHierarchicalStrategy(
    task: TeamTask,
    contributions: AgentContribution[]
  ): Promise<string> {
    // For now, treat as supervisor with first agent as root
    const rootAgent = Array.from(this.agents.values())[0];
    if (!rootAgent) {
      throw new Error('No agents configured');
    }

    this.supervisor = rootAgent.agentId;
    return this.executeSupervisorStrategy(task, contributions);
  }

  /**
   * Run a single agent with a prompt
   */
  private async runAgent(agent: AgentState, prompt: string): Promise<string> {
    agent.status = 'working';
    
    const llm = agent.role.llm ?? this.llm;
    const result = await llm.generate(prompt, {
      systemPrompt: agent.role.systemPrompt,
      temperature: 0.7,
    });

    agent.status = 'completed';
    agent.results.push(result.content);

    return result.content;
  }

  /**
   * Send a message between agents
   */
  private sendMessage(
    from: string,
    to: string | 'broadcast',
    content: string,
    type: AgentMessage['type']
  ): AgentMessage {
    const message: AgentMessage = {
      id: generateId(),
      from,
      to,
      content,
      type,
      timestamp: Date.now(),
    };

    this.messageHistory.push(message);

    // Deliver to recipient(s)
    if (to === 'broadcast') {
      for (const [id, agent] of this.agents) {
        if (id !== from) {
          agent.messages.push(message);
        }
      }
    } else {
      const recipient = this.agents.get(to);
      if (recipient) {
        recipient.messages.push(message);
      }
    }

    return message;
  }

  /**
   * Build supervisor planning prompt
   */
  private buildSupervisorPlanPrompt(task: TeamTask, workers: AgentRole[]): string {
    const workerDescriptions = workers
      .map(w => `- ${w.name}: ${w.description}`)
      .join('\n');

    return `You are coordinating a team to complete this task:

Task: ${task.description}
${task.context ? `Context: ${task.context}` : ''}

Available team members:
${workerDescriptions}

Create a plan assigning specific subtasks to each team member.
Format: 
AGENT_NAME: specific subtask description

Be specific about what each agent should do.`;
  }

  /**
   * Parse assignments from supervisor response
   */
  private parseAssignments(response: string, agentIds: string[]): Record<string, string> {
    const assignments: Record<string, string> = {};
    const lines = response.split('\n');

    for (const line of lines) {
      for (const agentId of agentIds) {
        const agent = this.agents.get(agentId);
        if (!agent) continue;

        const patterns = [
          new RegExp(`^${agent.role.name}:\\s*(.+)`, 'i'),
          new RegExp(`^${agentId}:\\s*(.+)`, 'i'),
        ];

        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match) {
            assignments[agentId] = match[1].trim();
            break;
          }
        }
      }
    }

    // If no assignments parsed, give everyone the full task
    if (Object.keys(assignments).length === 0) {
      for (const agentId of agentIds) {
        assignments[agentId] = response;
      }
    }

    return assignments;
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(task: TeamTask, results: string[]): string {
    return `Task: ${task.description}

Team results:
${results.join('\n\n')}

Synthesize these results into a final, coherent response:`;
  }

  /**
   * Synthesize multiple results
   */
  private async synthesizeResults(task: TeamTask, results: string[]): Promise<string> {
    const prompt = this.buildSynthesisPrompt(task, results);
    const response = await this.llm.generate(prompt, {
      temperature: 0.3,
    });
    return response.content;
  }

  /**
   * Check if task is complete
   */
  private async isTaskComplete(task: TeamTask, output: string): Promise<boolean> {
    const prompt = `Task: ${task.description}

Current output:
${output}

Is this task complete? Answer only YES or NO.`;

    const response = await this.llm.generate(prompt, {
      temperature: 0,
      maxTokens: 10,
    });

    return response.content.trim().toUpperCase().includes('YES');
  }

  /**
   * Check for consensus among proposals
   */
  private async checkConsensus(proposals: string[]): Promise<boolean> {
    if (proposals.length < 2) return true;

    const prompt = `Compare these proposals and determine if they are substantially similar (>70% agreement):

${proposals.map((p, i) => `Proposal ${i + 1}: ${p}`).join('\n\n')}

Are they in consensus? Answer only YES or NO.`;

    const response = await this.llm.generate(prompt, {
      temperature: 0,
      maxTokens: 10,
    });

    return response.content.trim().toUpperCase().includes('YES');
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get message history
   */
  getMessageHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }
}

/**
 * Create an agent team
 */
export function createAgentTeam(config: AgentTeamConfig): AgentTeam {
  return new AgentTeam(config);
}
