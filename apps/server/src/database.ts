import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type {
  Conversation,
  Message,
  Run,
  RunEvent,
  RunStatus,
  ToolCall,
} from "@pi-agent/contracts";
import { isActiveRun } from "@pi-agent/contracts";

type DbRow = Record<string, unknown>;
type NewRunEvent = RunEvent extends infer Event
  ? Event extends RunEvent
    ? Omit<Event, "runId" | "seq" | "createdAt">
    : never
  : never;

export class AppDatabase {
  readonly db: Database.Database;

  constructor(filename: string) {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
    this.interruptOrphanedRuns();
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT NOT NULL,
        workdir TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_conversation_idx
        ON messages(conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        args_json TEXT NOT NULL,
        result TEXT,
        error TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        assistant_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS runs_conversation_idx
        ON runs(conversation_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS runs_idempotency_conversation_idx
        ON runs(conversation_id, idempotency_key);
      CREATE UNIQUE INDEX IF NOT EXISTS runs_one_active_conversation_idx
        ON runs(conversation_id)
        WHERE status IN ('queued', 'running', 'cancelling');
      CREATE TABLE IF NOT EXISTS run_events (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(run_id, seq)
      );
    `);
  }

  private interruptOrphanedRuns() {
    const now = Date.now();
    this.db.prepare(`
      UPDATE runs SET status = 'interrupted', error = 'Server restarted while the task was running', updated_at = ?
      WHERE status IN ('queued', 'running', 'cancelling')
    `).run(now);
  }

  listConversations(): Conversation[] {
    return this.db.transaction(() => {
      const rows = this.db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all() as DbRow[];
      return rows.map((row) => this.hydrateConversation(row));
    })();
  }

  getConversation(id: string): Conversation | undefined {
    return this.db.transaction(() => {
      const row = this.db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as DbRow | undefined;
      return row ? this.hydrateConversation(row) : undefined;
    })();
  }

  createConversation(input: { title?: string; model: string; workdir?: string; id?: string }): Conversation {
    const now = Date.now();
    const id = input.id || randomUUID();
    this.db.prepare(`
      INSERT INTO conversations (id, title, model, workdir, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, input.title || "新对话", input.model, input.workdir || "", now, now);
    return this.getConversation(id)!;
  }

  importConversation(conversation: Conversation): Conversation {
    const exists = this.getConversation(conversation.id);
    if (exists) return exists;
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO conversations (id, title, model, workdir, archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        conversation.id,
        conversation.title || "新对话",
        conversation.model,
        conversation.workdir || "",
        Number(conversation.archived),
        conversation.createdAt,
        conversation.updatedAt,
      );
      for (const message of conversation.messages) {
        this.db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(message.id, conversation.id, message.role, message.content, message.timestamp);
        for (const tool of message.toolCalls || []) {
          this.db.prepare(`
            INSERT INTO tool_calls (id, message_id, name, args_json, result, error, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            tool.id,
            message.id,
            tool.name,
            JSON.stringify(tool.args || (tool as ToolCall & { arguments?: Record<string, unknown> }).arguments || {}),
            tool.result || null,
            tool.error || null,
            tool.status,
            message.timestamp,
          );
        }
      }
    })();
    return this.getConversation(conversation.id)!;
  }

  updateConversation(id: string, updates: { workdir?: string; archived?: boolean; model?: string }) {
    const current = this.getConversation(id);
    if (!current) return undefined;
    this.db.prepare(`
      UPDATE conversations SET workdir = ?, archived = ?, model = ?, updated_at = ? WHERE id = ?
    `).run(
      updates.workdir ?? current.workdir,
      Number(updates.archived ?? current.archived),
      updates.model ?? current.model,
      Date.now(),
      id,
    );
    return this.getConversation(id);
  }

  deleteConversation(id: string): boolean {
    return this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id).changes > 0;
  }

  startRun(input: {
    conversationId: string;
    content: string;
    model: string;
    idempotencyKey: string;
  }): { run: Run; created: boolean } {
    try {
      const result = this.db.transaction(() => {
        const existing = this.db.prepare(`
          SELECT id FROM runs WHERE conversation_id = ? AND idempotency_key = ?
        `).get(input.conversationId, input.idempotencyKey) as { id: string } | undefined;
        if (existing) return { runId: existing.id, created: false };

        const active = this.getActiveRun(input.conversationId);
        if (active) throw new Error("CONVERSATION_BUSY");

        const now = Date.now();
        const runId = randomUUID();
        const userMessageId = randomUUID();
        const assistantMessageId = randomUUID();
        const firstUser = (this.db.prepare(
          "SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ? AND role = 'user'",
        ).get(input.conversationId) as { count: number }).count === 0;
        const title = input.content.slice(0, 50) + (input.content.length > 50 ? "..." : "");

        this.db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, 'user', ?, ?)
        `).run(userMessageId, input.conversationId, input.content, now);
        this.db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, 'assistant', '', ?)
        `).run(assistantMessageId, input.conversationId, now + 1);
        this.db.prepare(`
          INSERT INTO runs (id, conversation_id, assistant_message_id, idempotency_key, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'queued', ?, ?)
        `).run(runId, input.conversationId, assistantMessageId, input.idempotencyKey, now, now);
        this.db.prepare(`
          UPDATE conversations SET title = CASE WHEN ? THEN ? ELSE title END, model = ?, updated_at = ? WHERE id = ?
        `).run(Number(firstUser), title, input.model, now, input.conversationId);
        return { runId, created: true };
      })();
      return { run: this.getRun(result.runId)!, created: result.created };
    } catch (error) {
      const existing = this.db.prepare(`
        SELECT id FROM runs WHERE conversation_id = ? AND idempotency_key = ?
      `).get(input.conversationId, input.idempotencyKey) as { id: string } | undefined;
      if (existing) return { run: this.getRun(existing.id)!, created: false };
      const conflicting = this.db.prepare(`
        SELECT id FROM runs WHERE conversation_id != ? AND idempotency_key = ?
      `).get(input.conversationId, input.idempotencyKey) as { id: string } | undefined;
      if (conflicting) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
      if (
        String(error).includes("runs_one_active_conversation_idx") ||
        String(error).includes("UNIQUE constraint failed: runs.conversation_id")
      ) {
        throw new Error("CONVERSATION_BUSY");
      }
      throw error;
    }
  }

  getRun(id: string): Run | undefined {
    const row = this.db.prepare(`
      SELECT r.*, COALESCE(MAX(e.seq), 0) AS last_seq
      FROM runs r LEFT JOIN run_events e ON e.run_id = r.id
      WHERE r.id = ? GROUP BY r.id
    `).get(id) as DbRow | undefined;
    return row ? this.mapRun(row) : undefined;
  }

  getActiveRun(conversationId: string): Run | undefined {
    const row = this.db.prepare(`
      SELECT r.*, COALESCE(MAX(e.seq), 0) AS last_seq
      FROM runs r LEFT JOIN run_events e ON e.run_id = r.id
      WHERE r.conversation_id = ? AND r.status IN ('queued', 'running', 'cancelling')
      GROUP BY r.id ORDER BY r.created_at DESC LIMIT 1
    `).get(conversationId) as DbRow | undefined;
    return row ? this.mapRun(row) : undefined;
  }

  getLatestRun(conversationId: string): Run | undefined {
    const row = this.db.prepare(`
      SELECT r.*, COALESCE(MAX(e.seq), 0) AS last_seq
      FROM runs r LEFT JOIN run_events e ON e.run_id = r.id
      WHERE r.conversation_id = ?
      GROUP BY r.id ORDER BY r.created_at DESC LIMIT 1
    `).get(conversationId) as DbRow | undefined;
    return row ? this.mapRun(row) : undefined;
  }

  setRunStatus(id: string, status: RunStatus, error?: string) {
    this.db.prepare("UPDATE runs SET status = ?, error = ?, updated_at = ? WHERE id = ?")
      .run(status, error || null, Date.now(), id);
  }

  appendEvent(
    runId: string,
    event: NewRunEvent,
  ): RunEvent {
    return this.db.transaction(() => {
      const seqRow = this.db.prepare(
        "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM run_events WHERE run_id = ?",
      ).get(runId) as { seq: number };
      const createdAt = Date.now();
      const full = { ...event, runId, seq: seqRow.seq, createdAt } as RunEvent;
      this.db.prepare(`
        INSERT INTO run_events (run_id, seq, type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(runId, full.seq, full.type, JSON.stringify(full), createdAt);
      this.applyRunTransition(full);
      this.applyProjection(full);
      return full;
    })();
  }

  getEvents(runId: string, after = 0): RunEvent[] {
    const rows = this.db.prepare(`
      SELECT payload_json FROM run_events WHERE run_id = ? AND seq > ? ORDER BY seq
    `).all(runId, after) as Array<{ payload_json: string }>;
    return rows.map((row) => JSON.parse(row.payload_json) as RunEvent);
  }

  getHistory(conversationId: string, beforeMessageId: string): Array<{ role: "user" | "assistant"; content: string }> {
    const target = this.db.prepare("SELECT created_at FROM messages WHERE id = ?").get(beforeMessageId) as { created_at: number };
    return this.db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ? AND created_at < ? AND role IN ('user', 'assistant')
      ORDER BY created_at
    `).all(conversationId, target.created_at) as Array<{ role: "user" | "assistant"; content: string }>;
  }

  private applyProjection(event: RunEvent) {
    const run = this.getRun(event.runId)!;
    if (event.type === "assistant.delta") {
      this.db.prepare("UPDATE messages SET content = content || ? WHERE id = ?")
        .run(event.content, run.assistantMessageId);
    } else if (event.type === "run.failed") {
      this.db.prepare("UPDATE messages SET content = content || ? WHERE id = ?")
        .run(`\n\n❌ ${event.message}`, run.assistantMessageId);
    } else if (event.type === "tool.started") {
      this.db.prepare(`
        INSERT OR REPLACE INTO tool_calls (id, message_id, name, args_json, status, created_at)
        VALUES (?, ?, ?, ?, 'running', ?)
      `).run(event.tool.id, run.assistantMessageId, event.tool.name, JSON.stringify(event.tool.args), event.createdAt);
    } else if (event.type === "tool.completed") {
      this.db.prepare(`
        UPDATE tool_calls SET result = ?, error = ?, status = ? WHERE id = ?
      `).run(event.result, event.error || null, event.error ? "error" : "completed", event.toolId);
    }
    this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(event.createdAt, run.conversationId);
  }

  private applyRunTransition(event: RunEvent) {
    if (event.type === "run.started") {
      this.db.prepare("UPDATE runs SET status = 'running', error = NULL, updated_at = ? WHERE id = ?")
        .run(event.createdAt, event.runId);
    } else if (event.type === "run.completed") {
      this.db.prepare("UPDATE runs SET status = 'completed', error = NULL, updated_at = ? WHERE id = ?")
        .run(event.createdAt, event.runId);
    } else if (event.type === "run.failed") {
      this.db.prepare("UPDATE runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
        .run(event.message, event.createdAt, event.runId);
    } else if (event.type === "run.cancelled") {
      this.db.prepare("UPDATE runs SET status = 'cancelled', error = NULL, updated_at = ? WHERE id = ?")
        .run(event.createdAt, event.runId);
    }
  }

  private hydrateConversation(row: DbRow): Conversation {
    const id = String(row.id);
    const messageRows = this.db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at
    `).all(id) as DbRow[];
    const messages = messageRows.map((message): Message => {
      const toolRows = this.db.prepare(`
        SELECT * FROM tool_calls WHERE message_id = ? ORDER BY created_at
      `).all(String(message.id)) as DbRow[];
      const toolCalls = toolRows.map((tool): ToolCall => ({
        id: String(tool.id),
        name: String(tool.name),
        args: JSON.parse(String(tool.args_json)),
        result: tool.result == null ? undefined : String(tool.result),
        error: tool.error == null ? undefined : String(tool.error),
        status: tool.status as ToolCall["status"],
      }));
      return {
        id: String(message.id),
        role: message.role as Message["role"],
        content: String(message.content),
        timestamp: Number(message.created_at),
        ...(toolCalls.length ? { toolCalls } : {}),
      };
    });
    const latestRun = this.getLatestRun(id);
    return {
      id,
      title: String(row.title),
      model: String(row.model),
      workdir: String(row.workdir),
      archived: Boolean(row.archived),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      contextTokens: estimateTokens(messages),
      messages,
      activeRun: latestRun && isActiveRun(latestRun.status) ? latestRun : undefined,
      latestRun,
    };
  }

  private mapRun(row: DbRow): Run {
    return {
      id: String(row.id),
      conversationId: String(row.conversation_id),
      assistantMessageId: String(row.assistant_message_id),
      status: row.status as RunStatus,
      lastSeq: Number(row.last_seq || 0),
      error: row.error == null ? undefined : String(row.error),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }
}

function estimateTokens(messages: Message[]): number {
  let chars = 2_000;
  for (const message of messages) {
    chars += message.content.length;
    for (const tool of message.toolCalls || []) {
      chars += JSON.stringify(tool.args).length + (tool.result || tool.error || "").length;
    }
  }
  return Math.ceil(chars / 2.5);
}
