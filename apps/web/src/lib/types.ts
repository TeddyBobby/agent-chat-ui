export type {
  Conversation,
  Message,
  Run,
  RunEvent,
  RunStatus,
  ToolCall,
} from "@pi-agent/contracts";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  contextLimit: number;
}

export const MODELS: ModelInfo[] = [
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", contextLimit: 1_048_576 },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", contextLimit: 1_048_576 },
  { id: "gemma4:12b", name: "Gemma 4 12B (本地)", provider: "Ollama", baseUrl: "http://localhost:11434/v1", contextLimit: 32_768 },
  { id: "gemma4:e4b", name: "Gemma 4 8B (本地)", provider: "Ollama", baseUrl: "http://localhost:11434/v1", contextLimit: 8_192 },
];
