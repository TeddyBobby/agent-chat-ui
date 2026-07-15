// Core types for the Agent Chat UI

export interface Conversation {
  id: string;
  title: string;
  model: string;
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
  status: 'running' | 'completed' | 'error';
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export const MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'deepseek-v4', name: 'DeepSeek V4', provider: 'DeepSeek' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'ollama-local', name: 'Local Model', provider: 'Ollama' },
];
