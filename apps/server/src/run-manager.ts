import { PiAgent, createTools, type StepEvent } from "@pi-agent/agent";
import { isActiveRun, type Run, type RunEvent, type StartRunRequest } from "@pi-agent/contracts";
import { AppDatabase } from "./database.js";
import { CredentialVault } from "./credential-vault.js";

type Subscriber = (event: RunEvent) => void;
type NewRunEvent = RunEvent extends infer Event
  ? Event extends RunEvent
    ? Omit<Event, "runId" | "seq" | "createdAt">
    : never
  : never;

export class RunManager {
  private subscribers = new Map<string, Set<Subscriber>>();
  private controllers = new Map<string, AbortController>();

  constructor(
    private readonly database: AppDatabase,
    private readonly credentials: CredentialVault,
  ) {}

  start(conversationId: string, request: StartRunRequest): Run {
    const { run, created } = this.database.startRun({
      conversationId,
      content: request.content,
      model: request.model,
      idempotencyKey: request.idempotencyKey,
    });
    if (created) queueMicrotask(() => void this.execute(run, request));
    return run;
  }

  get(runId: string) {
    return this.database.getRun(runId);
  }

  replay(runId: string, after: number) {
    return this.database.getEvents(runId, after);
  }

  subscribeFrom(runId: string, after: number, subscriber: Subscriber) {
    const events = this.database.getEvents(runId, after);
    const unsubscribe = this.subscribe(runId, subscriber);
    return { events, unsubscribe };
  }

  subscribe(runId: string, subscriber: Subscriber): () => void {
    const listeners = this.subscribers.get(runId) || new Set<Subscriber>();
    listeners.add(subscriber);
    this.subscribers.set(runId, listeners);
    return () => {
      listeners.delete(subscriber);
      if (listeners.size === 0) this.subscribers.delete(runId);
    };
  }

  cancel(runId: string): Run | undefined {
    const run = this.database.getRun(runId);
    if (!run || !isActiveRun(run.status)) return run;
    this.database.setRunStatus(runId, "cancelling");
    this.controllers.get(runId)?.abort();
    return this.database.getRun(runId);
  }

  private publish(
    runId: string,
    event: NewRunEvent,
  ) {
    const persisted = this.database.appendEvent(runId, event);
    for (const subscriber of this.subscribers.get(runId) || []) subscriber(persisted);
    return persisted;
  }

  private async execute(run: Run, request: StartRunRequest) {
    const current = this.database.getRun(run.id);
    if (!current || current.status === "cancelling" || current.status === "cancelled") {
      if (current) {
        this.publish(run.id, { type: "run.cancelled" });
      }
      return;
    }
    const conversation = this.database.getConversation(run.conversationId);
    if (!conversation) return;
    const controller = new AbortController();
    this.controllers.set(run.id, controller);
    try {
      this.publish(run.id, { type: "run.started" });
      const apiBase = resolveBaseUrl(request.model, request.baseUrl);
      const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");
      const apiKey = this.credentials.getApiKey() ||
        (request.model.startsWith("deepseek") ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY) ||
        "";
      if (!apiKey && !isLocal) throw new Error("需要 API 密钥");

      const workdir = conversation.workdir || process.env.PI_AGENT_WORKDIR || process.env.INIT_CWD || process.cwd();
      const history = this.database.getHistory(run.conversationId, run.assistantMessageId);
      const task = history.at(-1)?.role === "user" ? history.pop()!.content : request.content;
      const agent = new PiAgent({
        apiKey,
        model: request.model,
        baseURL: apiBase,
        maxSteps: 60,
        abortSignal: controller.signal,
        contextLimit: request.contextLimit || 128_000,
        systemPrompt: `你是一个 coding agent，当前工作目录是 ${workdir}。所有文件路径都相对于这个目录。`,
      });
      for (const tool of createTools(workdir)) agent.use(tool);
      agent.on((event) => this.onAgentEvent(run.id, event));
      await agent.run(task, history.length ? history : undefined);
      if (controller.signal.aborted) {
        this.publish(run.id, { type: "run.cancelled" });
      } else {
        this.publish(run.id, { type: "run.completed" });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        this.publish(run.id, { type: "run.cancelled" });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.publish(run.id, { type: "run.failed", message });
      }
    } finally {
      this.controllers.delete(run.id);
    }
  }

  private onAgentEvent(runId: string, event: StepEvent) {
    if ((event.type === "text_chunk" || event.type === "answer") && event.content) {
      this.publish(runId, { type: "assistant.delta", content: event.content });
    } else if (event.type === "action") {
      this.publish(runId, {
        type: "tool.started",
        tool: {
          id: event.toolCallId || crypto.randomUUID(),
          name: event.toolName || "unknown",
          args: event.toolArgs || {},
          status: "running",
        },
      });
    } else if (event.type === "observation") {
      this.publish(runId, {
        type: "tool.completed",
        toolId: event.toolCallId || "",
        result: event.content,
      });
    }
  }
}

function resolveBaseUrl(model: string, explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, "");
  if (model.includes(":")) return (process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "");
  if (model.startsWith("deepseek")) return (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}
