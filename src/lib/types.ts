// Core types for the Agent Chat UI

export interface Conversation {
  id: string;
  title: string;
  model: string;
  workdir: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
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
  arguments: Record<string, unknown>;
  result?: string;
  error?: string;
  status: 'running' | 'completed' | 'error';
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
}

export const MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'gemma4:e4b', name: 'Gemma 4 (本地)', provider: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
];

// SSE event types emitted by /api/chat
export type AgentEvent =
  | { type: 'start'; workdir: string }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; id: string; result?: string; error?: string }
  | { type: 'text'; content: string }
  | { type: 'error'; message: string }
  | { type: 'done' };
