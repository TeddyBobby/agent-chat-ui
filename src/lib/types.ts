// Core types for the Agent Chat UI

export interface Conversation {
  id: string;
  title: string;
  model: string;
  workdir: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  contextTokens: number;
  archived: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  status: 'running' | 'completed' | 'error';
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  contextLimit: number;
}

export const MODELS: ModelInfo[] = [
  { id: 'deepseek-v4-pro',  name: 'DeepSeek V4 Pro',  provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', contextLimit: 1048576 },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', contextLimit: 1048576 },
  { id: 'gemma4:12b', name: 'Gemma 4 12B (本地)', provider: 'Ollama', baseUrl: 'http://localhost:11434/v1', contextLimit: 32768 },
  { id: 'gemma4:e4b', name: 'Gemma 4 8B (本地)',  provider: 'Ollama', baseUrl: 'http://localhost:11434/v1', contextLimit: 8192 },
];

// SSE event types emitted by /api/chat
export type AgentEvent =
  | { type: 'start'; workdir: string }
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; result: string; error?: string }
  | { type: 'error'; message: string }
  | { type: 'done' };
