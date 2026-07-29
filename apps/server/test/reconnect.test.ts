import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Run, RunEvent } from "@pi-agent/contracts";
import { createAppServer } from "../src/server.js";

let app: ReturnType<typeof createAppServer>;
let apiUrl: string;
let modelServer: ReturnType<typeof createServer>;
let modelUrl: string;
let modelCalls = 0;

before(async () => {
  modelServer = createServer((req, res) => {
    modelCalls += 1;
    if (req.url?.includes("/fail/")) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "synthetic model failure" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const chunks = ["后台", "任务", "继续", "完成"];
    let index = 0;
    const timer = setInterval(() => {
      if (index < chunks.length) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[index++] } }] })}\n\n`);
      } else {
        clearInterval(timer);
        res.end("data: [DONE]\n\n");
      }
    }, 60);
    res.on("close", () => clearInterval(timer));
  });
  await new Promise<void>((resolve) => modelServer.listen(0, "127.0.0.1", resolve));
  modelUrl = `http://127.0.0.1:${(modelServer.address() as AddressInfo).port}/v1`;

  app = createAppServer({ database: ":memory:", port: 0, host: "127.0.0.1" });
  const address = await app.listen();
  apiUrl = `http://${address.host}:${address.port}`;
});

after(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) => modelServer.close((error) => error ? reject(error) : resolve()));
});

test("a run survives subscriber disconnect and replays missed events", async () => {
  const conversation = await post("/v1/conversations", {
    model: "fake-model",
    workdir: process.cwd(),
  });
  const request = {
    content: "run after refresh",
    model: "fake-model",
    baseUrl: modelUrl,
    apiKey: "test",
    idempotencyKey: "refresh-run",
  };
  const run = await post(`/v1/conversations/${conversation.id}/runs`, request) as Run;

  const firstController = new AbortController();
  const firstEvents = await readEvents(run.id, 0, firstController, (event) => {
    if (event.type === "assistant.delta") firstController.abort();
  });
  const firstDelta = firstEvents.find((event) => event.type === "assistant.delta");
  assert.ok(firstDelta, "the initial subscriber should receive a text delta");

  await waitFor(async () => {
    const current = await get(`/v1/runs/${run.id}`) as Run;
    return current.status === "completed";
  });

  const replayed = await readEvents(run.id, firstDelta.seq, new AbortController(), (event, controller) => {
    if (event.type === "run.completed") controller.abort();
  });
  assert.ok(replayed.some((event) => event.type === "run.completed"));
  assert.equal(
    replayed.filter((event) => event.type === "assistant.delta").map((event) => event.content).join(""),
    "任务继续完成",
  );

  const snapshot = await get(`/v1/conversations/${conversation.id}`);
  assert.equal(snapshot.messages.at(-1).content, "后台任务继续完成");
});

test("an idempotency key never starts the agent twice", async () => {
  const beforeCalls = modelCalls;
  const conversation = await post("/v1/conversations", {
    model: "fake-model",
    workdir: process.cwd(),
  });
  const request = {
    content: "only once",
    model: "fake-model",
    baseUrl: modelUrl,
    apiKey: "test",
    idempotencyKey: "same-command",
  };
  const first = await post(`/v1/conversations/${conversation.id}/runs`, request) as Run;
  const second = await post(`/v1/conversations/${conversation.id}/runs`, request) as Run;
  assert.equal(second.id, first.id);
  await waitFor(async () => (await get(`/v1/runs/${first.id}`) as Run).status === "completed");
  assert.equal(modelCalls - beforeCalls, 1);

  const otherConversation = await post("/v1/conversations", {
    model: "fake-model",
    workdir: process.cwd(),
  });
  const otherRun = await post(`/v1/conversations/${otherConversation.id}/runs`, request) as Run;
  assert.notEqual(otherRun.id, first.id, "idempotency is scoped to a conversation");
  await waitFor(async () => (await get(`/v1/runs/${otherRun.id}`) as Run).status === "completed");
});

test("a failed run remains visible in the persisted conversation snapshot", async () => {
  const conversation = await post("/v1/conversations", {
    model: "fail-model",
    workdir: process.cwd(),
  });
  const run = await post(`/v1/conversations/${conversation.id}/runs`, {
    content: "fail and persist",
    model: "fail-model",
    baseUrl: `${modelUrl}/fail`,
    apiKey: "test",
    idempotencyKey: "failed-run",
  }) as Run;

  await waitFor(async () => (await get(`/v1/runs/${run.id}`) as Run).status === "failed");
  const snapshot = await get(`/v1/conversations/${conversation.id}`);
  assert.equal(snapshot.latestRun.id, run.id);
  assert.equal(snapshot.latestRun.status, "failed");
  assert.match(snapshot.messages.at(-1).content, /synthetic model failure/);
});

async function readEvents(
  runId: string,
  afterSeq: number,
  controller: AbortController,
  stop: (event: RunEvent, controller: AbortController) => void,
): Promise<RunEvent[]> {
  const events: RunEvent[] = [];
  try {
    const response = await fetch(`${apiUrl}/v1/runs/${runId}/events?after=${afterSeq}`, {
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const data = frame.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
        if (!data) continue;
        const event = JSON.parse(data) as RunEvent;
        events.push(event);
        stop(event, controller);
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  }
  return events;
}

async function post(path: string, body: unknown): Promise<any> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    assert.fail(`${path} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function get(path: string): Promise<any> {
  const response = await fetch(`${apiUrl}${path}`);
  assert.ok(response.ok);
  return response.json();
}

async function waitFor(predicate: () => Promise<boolean>, timeout = 3_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("condition was not met before timeout");
}
