import type { Tool, ToolResult } from '../types.js';

/**
 * Result of a context compression operation
 */
export interface CompactConversationResult {
  /** Whether the compression was successful */
  success: boolean;
  /** Reason for the compression */
  reason: string;
  /** Generated summary of compressed messages */
  summary: string;
  /** Number of messages that were compressed */
  messagesCompressed: number;
  /** Estimated tokens saved */
  tokensSaved: number;
  /** Timestamp of the compression */
  compressedAt: number;
}

/**
 * Configuration for the compact conversation tool
 */
export interface CompactConversationToolConfig {
  /** Function to perform the actual compression */
  compress: () => Promise<CompactConversationResult>;
  /** Optional: Get current message count */
  getMessageCount?: () => number;
  /** Optional: Get current token estimate */
  getTokenEstimate?: () => number;
}

/**
 * Creates a compact_conversation tool that allows agents to autonomously
 * decide when to compress their conversation history.
 * 
 * This is similar to LangChain's "Autonomous Context Compression" feature,
 * but integrated into OrkaJS's tool system.
 * 
 * @example
 * ```typescript
 * import { createCompactConversationTool } from '@orka-js/agent';
 * import { SummaryMemory } from '@orka-js/memory-store';
 * 
 * const memory = new SummaryMemory({ llm });
 * 
 * const compactTool = createCompactConversationTool({
 *   compress: async () => {
 *     const before = memory.getMessageCount();
 *     await memory.compress();
 *     const after = memory.getMessageCount();
 *     return {
 *       success: true,
 *       reason: 'Agent-initiated compression',
 *       summary: memory.getSummary(),
 *       messagesCompressed: before - after,
 *       tokensSaved: (before - after) * 50, // estimate
 *       compressedAt: Date.now(),
 *     };
 *   }
 * });
 * 
 * const agent = new ReActAgent({
 *   tools: [compactTool, ...otherTools],
 *   // ...
 * });
 * ```
 */
export function createCompactConversationTool(
  config: CompactConversationToolConfig
): Tool {
  return {
    name: 'compact_conversation',
    description: `Compress the conversation history to free up context space. Use this tool when:
- The conversation is getting long and you want to preserve context efficiently
- You're transitioning to a new task or subtask and want a clean context
- You notice repetitive information in the conversation history
- You're approaching context limits and need to make room for new information

The tool will summarize older messages while preserving the most important context.
Returns a summary of what was compressed and how many messages were affected.`,
    parameters: [
      {
        name: 'reason',
        type: 'string',
        description: 'Why you are compacting the conversation (e.g., "switching to new task", "context getting long", "removing redundant information")',
        required: true,
      },
    ],
    execute: async (input: Record<string, unknown>): Promise<ToolResult> => {
      const reason = input.reason as string;

      try {
        const result = await config.compress();

        if (!result.success) {
          return {
            output: `Compression skipped: ${result.reason}`,
            metadata: { success: false, reason: result.reason },
          };
        }

        const output = [
          `✅ Conversation compressed successfully.`,
          ``,
          `**Reason:** ${reason}`,
          `**Messages compressed:** ${result.messagesCompressed}`,
          `**Estimated tokens saved:** ~${result.tokensSaved}`,
          ``,
          `**Summary of compressed content:**`,
          result.summary,
        ].join('\n');

        return {
          output,
          metadata: {
            success: true,
            messagesCompressed: result.messagesCompressed,
            tokensSaved: result.tokensSaved,
            summary: result.summary,
            compressedAt: result.compressedAt,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          output: `Failed to compress conversation: ${errorMessage}`,
          error: errorMessage,
          metadata: { success: false },
        };
      }
    },
  };
}

/**
 * Pre-built compact conversation tool description for system prompts.
 * Include this in your agent's system prompt to help it understand when to use the tool.
 */
export const COMPACT_CONVERSATION_PROMPT_ADDITION = `
You have access to a 'compact_conversation' tool that compresses the conversation history.
Use it proactively when:
1. The conversation becomes lengthy (many back-and-forth exchanges)
2. You're about to start a new task or change topics significantly
3. You notice you're repeating context that was already established
4. You need to make room for new, important information

When you compact, older messages are summarized while recent context is preserved.
This helps maintain relevant context without hitting token limits.
`;
