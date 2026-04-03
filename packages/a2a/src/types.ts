/**
 * A2A Protocol types — based on Google's Agent-to-Agent open specification.
 * @see https://github.com/google/A2A
 */

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  url: string;
  capabilities: {
    streaming: boolean;
    tools: boolean;
    multiModal: boolean;
  };
  skills: AgentSkill[];
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputModes?: string[];
  outputModes?: string[];
}

export interface A2AMessagePart {
  type: 'text';
  text: string;
}

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2AMessagePart[];
}

export interface A2ATask {
  id: string;
  sessionId?: string;
  message: A2AMessage;
}

export interface A2AArtifact {
  name?: string;
  parts: A2AMessagePart[];
}

export type A2ATaskStatus = 'submitted' | 'working' | 'completed' | 'failed' | 'canceled';

export interface A2ATaskState {
  id: string;
  sessionId?: string;
  status: { state: A2ATaskStatus; message?: A2AMessage; timestamp?: string };
  artifacts?: A2AArtifact[];
}

/** JSON-RPC 2.0 request */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 response */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
