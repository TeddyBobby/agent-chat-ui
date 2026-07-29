import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isActiveRun, isTerminalRunEvent, type StartRunRequest } from "@pi-agent/contracts";
import type { Conversation } from "@pi-agent/contracts";
import { AppDatabase } from "./database.js";
import { RunManager } from "./run-manager.js";
import { CredentialVault } from "./credential-vault.js";

export interface ServerOptions {
  database?: string;
  port?: number;
  host?: string;
}

export function createAppServer(options: ServerOptions = {}) {
  const dataFile = options.database || process.env.PI_AGENT_DB ||
    resolve(process.env.INIT_CWD || process.cwd(), ".data/pi-agent.db");
  const database = new AppDatabase(dataFile);
  const credentials = new CredentialVault(
    database,
    dataFile === ":memory:" ? undefined : `${dataFile}.key`,
  );
  const runs = new RunManager(database, credentials);

  const server = createServer(async (req, res) => {
    if (!setCors(req, res)) return json(res, 403, { error: "origin not allowed" });
    if (req.method === "OPTIONS") return send(res, 204);
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true });
      }
      if (req.method === "GET" && url.pathname === "/v1/conversations") {
        return json(res, 200, database.listConversations());
      }
      if (req.method === "GET" && url.pathname === "/v1/credentials/api-key") {
        return json(res, 200, { configured: credentials.hasApiKey() });
      }
      if (req.method === "PUT" && url.pathname === "/v1/credentials/api-key") {
        const body = await readJson(req);
        if (typeof body.apiKey !== "string" || !body.apiKey.trim()) {
          return json(res, 400, { error: "apiKey is required" });
        }
        credentials.saveApiKey(body.apiKey);
        return json(res, 200, { configured: true });
      }
      if (req.method === "POST" && url.pathname === "/v1/logout") {
        credentials.clearApiKey();
        return json(res, 200, { configured: false });
      }
      if (req.method === "POST" && url.pathname === "/v1/conversations") {
        const body = await readJson(req);
        if (!body.model) return json(res, 400, { error: "model is required" });
        return json(res, 201, database.createConversation({
          title: body.title,
          model: String(body.model),
          workdir: body.workdir ? String(body.workdir) : "",
          id: body.id ? String(body.id) : undefined,
        }));
      }
      if (req.method === "POST" && url.pathname === "/v1/import") {
        const body = await readJson(req);
        const conversations = Array.isArray(body.conversations) ? body.conversations as Conversation[] : [];
        return json(res, 200, {
          imported: conversations.map((conversation) => database.importConversation(conversation).id),
        });
      }

      const conversationMatch = url.pathname.match(/^\/v1\/conversations\/([^/]+)$/);
      if (conversationMatch) {
        const conversationId = decodeURIComponent(conversationMatch[1]);
        if (req.method === "GET") {
          const conversation = database.getConversation(conversationId);
          return conversation ? json(res, 200, conversation) : json(res, 404, { error: "not found" });
        }
        if (req.method === "PATCH") {
          const body = await readJson(req);
          const conversation = database.updateConversation(conversationId, {
            workdir: typeof body.workdir === "string" ? body.workdir : undefined,
            archived: typeof body.archived === "boolean" ? body.archived : undefined,
            model: typeof body.model === "string" ? body.model : undefined,
          });
          return conversation ? json(res, 200, conversation) : json(res, 404, { error: "not found" });
        }
        if (req.method === "DELETE") {
          return database.deleteConversation(conversationId)
            ? send(res, 204)
            : json(res, 404, { error: "not found" });
        }
      }

      const startMatch = url.pathname.match(/^\/v1\/conversations\/([^/]+)\/runs$/);
      if (req.method === "POST" && startMatch) {
        const conversationId = decodeURIComponent(startMatch[1]);
        if (!database.getConversation(conversationId)) return json(res, 404, { error: "conversation not found" });
        const body = await readJson(req) as Partial<StartRunRequest>;
        if (!body.content || !body.model || !body.idempotencyKey) {
          return json(res, 400, { error: "content, model and idempotencyKey are required" });
        }
        try {
          const run = runs.start(conversationId, body as StartRunRequest);
          return json(res, 202, run);
        } catch (error) {
          if (error instanceof Error && error.message === "CONVERSATION_BUSY") {
            return json(res, 409, { error: "conversation already has an active run" });
          }
          if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_CONFLICT") {
            return json(res, 409, { error: "idempotency key belongs to another conversation" });
          }
          throw error;
        }
      }

      const runMatch = url.pathname.match(/^\/v1\/runs\/([^/]+)$/);
      if (req.method === "GET" && runMatch) {
        const run = runs.get(decodeURIComponent(runMatch[1]));
        return run ? json(res, 200, run) : json(res, 404, { error: "not found" });
      }

      const cancelMatch = url.pathname.match(/^\/v1\/runs\/([^/]+)\/cancel$/);
      if (req.method === "POST" && cancelMatch) {
        const run = runs.cancel(decodeURIComponent(cancelMatch[1]));
        return run ? json(res, 202, run) : json(res, 404, { error: "not found" });
      }

      const eventsMatch = url.pathname.match(/^\/v1\/runs\/([^/]+)\/events$/);
      if (req.method === "GET" && eventsMatch) {
        const runId = decodeURIComponent(eventsMatch[1]);
        if (!runs.get(runId)) return json(res, 404, { error: "not found" });
        const after = Number(url.searchParams.get("after") || req.headers["last-event-id"] || 0);
        return streamEvents(req, res, runs, runId, Number.isFinite(after) ? after : 0);
      }

      if (req.method === "GET" && url.pathname === "/v1/fs") {
        return browseDirectory(res, url.searchParams.get("path") || process.env.HOME || "/Users");
      }

      if (req.method === "POST" && url.pathname === "/v1/test-connection") {
        const body = await readJson(req);
        return testConnection(res, body, credentials);
      }

      return json(res, 404, { error: "not found" });
    } catch (error) {
      console.error("[server]", error);
      return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return {
    server,
    database,
    credentials,
    runs,
    listen() {
      const port = options.port ?? Number(process.env.PORT || 8787);
      const host = options.host ?? process.env.HOST ?? "127.0.0.1";
      return new Promise<{ port: number; host: string }>((resolvePromise, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          const address = server.address();
          resolvePromise({ port: typeof address === "object" && address ? address.port : port, host });
        });
      });
    },
    async close() {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => error ? reject(error) : resolvePromise());
      });
      database.close();
    },
  };
}

function streamEvents(
  req: IncomingMessage,
  res: ServerResponse,
  runs: RunManager,
  runId: string,
  after: number,
) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const subscription = runs.subscribeFrom(runId, after, (event) => {
    writeEvent(res, event);
    if (isTerminalRunEvent(event)) cleanup();
  });
  for (const event of subscription.events) writeEvent(res, event);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  const cleanup = () => {
    clearInterval(heartbeat);
    subscription.unsubscribe();
    if (!res.writableEnded) res.end();
  };
  req.once("close", cleanup);

  const current = runs.get(runId);
  if (current && !isActiveRun(current.status)) cleanup();
}

function writeEvent(res: ServerResponse, event: { seq: number }) {
  res.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
}

async function readJson(req: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function setCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    process.env.PI_AGENT_WEB_ORIGIN || "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);
  if (origin && !allowedOrigins.has(origin)) return false;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  return true;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function send(res: ServerResponse, status: number) {
  res.statusCode = status;
  res.end();
}

function browseDirectory(res: ServerResponse, rawDir: string) {
  const dir = rawDir.replace(/^~/, process.env.HOME || "/Users");
  const resolved = resolve(dir);
  if (["/", "/etc", "/var", "/tmp"].includes(resolved)) return json(res, 403, { error: "不允许访问系统目录" });
  try {
    const dirs = readdirSync(resolved, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({ name: entry.name, path: join(resolved, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const parent = dirname(resolved);
    const breadcrumb = resolved.split("/").filter(Boolean).reduce<Array<{ name: string; path: string }>>((acc, part) => {
      const path = acc.length === 0 ? `/${part}` : `${acc.at(-1)!.path}/${part}`;
      acc.push({ name: part, path });
      return acc;
    }, []);
    return json(res, 200, { current: resolved, parent: parent !== resolved ? parent : null, breadcrumb, dirs });
  } catch {
    return json(res, 404, { error: "无法读取目录" });
  }
}

async function testConnection(
  res: ServerResponse,
  body: Record<string, any>,
  credentials: CredentialVault,
) {
  const started = Date.now();
  const base = String(body.baseUrl || "").replace(/\/$/, "");
  const endpoint = /\/(responses|chat\/completions)$/.test(base) ? base : `${base}/chat/completions`;
  const apiKey = credentials.getApiKey();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: body.model,
        messages: [{ role: "user", content: "Reply with OK" }],
        max_tokens: 2,
        stream: false,
      }),
    });
    const text = await response.text();
    return json(res, 200, {
      success: response.ok,
      endpoint,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      responsePreview: text.slice(0, 300),
      duration: Date.now() - started,
      diagnosis: response.ok ? [] : [`HTTP ${response.status}`],
    });
  } catch (error) {
    return json(res, 200, {
      success: false,
      endpoint,
      status: 0,
      contentType: "",
      responsePreview: String(error),
      duration: Date.now() - started,
      diagnosis: ["无法连接模型端点"],
    });
  }
}
