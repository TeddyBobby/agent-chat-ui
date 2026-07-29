export type RunStatus =
  | "queued"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  status: "running" | "completed" | "error";
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface Run {
  id: string;
  conversationId: string;
  assistantMessageId: string;
  status: RunStatus;
  lastSeq: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

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
  activeRun?: Run;
  latestRun?: Run;
}

export type RunEvent =
  | { runId: string; seq: number; type: "run.started"; createdAt: number }
  | { runId: string; seq: number; type: "assistant.delta"; content: string; createdAt: number }
  | { runId: string; seq: number; type: "tool.started"; tool: ToolCall; createdAt: number }
  | { runId: string; seq: number; type: "tool.completed"; toolId: string; result: string; error?: string; createdAt: number }
  | { runId: string; seq: number; type: "run.completed"; createdAt: number }
  | { runId: string; seq: number; type: "run.failed"; message: string; createdAt: number }
  | { runId: string; seq: number; type: "run.cancelled"; createdAt: number };

export interface StartRunRequest {
  content: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  contextLimit?: number;
  idempotencyKey: string;
}

export const ACTIVE_RUN_STATUSES: RunStatus[] = ["queued", "running", "cancelling"];
export const TERMINAL_RUN_EVENT_TYPES: RunEvent["type"][] = [
  "run.completed",
  "run.failed",
  "run.cancelled",
];

export function isActiveRun(status: RunStatus): boolean {
  return ACTIVE_RUN_STATUSES.includes(status);
}

export function isTerminalRunEvent(event: RunEvent): boolean {
  return TERMINAL_RUN_EVENT_TYPES.includes(event.type);
}
