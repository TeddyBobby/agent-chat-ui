import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Run } from "@pi-agent/contracts";
import { createAppServer } from "../src/server.js";

let app: ReturnType<typeof createAppServer>;
let apiUrl: string;
let modelServer: ReturnType<typeof createServer>;
let modelUrl: string;

before(async () => {
  // 一个只会挂起、永不完成的模型端点：发送一个 delta 后保持连接，直到客户端因 cancel 中止。
  modelServer = createServer((req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "部分输出" } }] })}\n\n`);
      res.on("close", () => {});
    });
  });
  await new Promise<void>((resolve) => modelServer.listen(0, "127.0.0.1", resolve));
  modelUrl = `http://127.0.0.1:${(modelServer.address() as AddressInfo).port}/v1`;

  app = createAppServer({ database: ":memory:", port: 0, host: "127.0.0.1" });
  const address = await app.listen();
  apiUrl = `http://${address.host}:${address.port}`;
});

after(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) => modelServer.close((error) => (error ? reject(error) : resolve())));
});

test("cancelling a run persists a stopped marker and releases the conversation", async () => {
  const conversation = await post("/v1/conversations", { model: "fake-model", workdir: process.cwd() });
  const run = (await post(`/v1/conversations/${conversation.id}/runs`, {
    content: "cancel me",
    model: "fake-model",
    baseUrl: `${modelUrl}/hang`,
    idempotencyKey: "cancel-run",
  })) as Run;

  await waitFor(async () => ((await get(`/v1/runs/${run.id}`)) as Run).status === "running");

  const cancelling = (await post(`/v1/runs/${run.id}/cancel`, {})) as Run;
  assert.equal(cancelling.status, "cancelling");

  await waitFor(async () => ((await get(`/v1/runs/${run.id}`)) as Run).status === "cancelled");

  const snapshot = await get(`/v1/conversations/${conversation.id}`);
  assert.equal(snapshot.latestRun.status, "cancelled");
  assert.equal(snapshot.activeRun, undefined);
  assert.match(snapshot.messages.at(-1).content, /已停止/);
});

async function post(path: string, body: unknown): Promise<any> {
  return request(path, "POST", body);
}

async function request(path: string, method: string, body?: unknown): Promise<any> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) assert.fail(`${path} returned ${response.status}: ${await response.text()}`);
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
