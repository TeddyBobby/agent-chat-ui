import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createAppServer } from "../src/server.js";

let app: ReturnType<typeof createAppServer>;
let apiUrl: string;
let workspace: string;

before(async () => {
  workspace = mkdtempSync(join(tmpdir(), "pi-agent-workspace-"));
  mkdirSync(join(workspace, "src"));
  writeFileSync(join(workspace, "src", "index.ts"), "export const answer = 42;\n");
  writeFileSync(join(workspace, "README.md"), "# Demo\n");
  execFileSync("git", ["init"], { cwd: workspace });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: workspace });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: workspace });
  execFileSync("git", ["add", "."], { cwd: workspace });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: workspace });
  writeFileSync(join(workspace, "src", "index.ts"), "export const answer = 43;\n");
  writeFileSync(join(workspace, "untracked.txt"), "new review content\n");
  writeFileSync(join(workspace, "中文 文件.ts"), "export const localized = true;\n");

  app = createAppServer({ database: ":memory:", port: 0, host: "127.0.0.1" });
  const address = await app.listen();
  apiUrl = `http://${address.host}:${address.port}`;
});

after(async () => {
  await app.close();
  rmSync(workspace, { recursive: true, force: true });
});

test("workspace tree lists project files without hidden internals", async () => {
  const response = await fetch(`${apiUrl}/v1/workspace/tree?path=${encodeURIComponent(workspace)}`);
  assert.equal(response.status, 200);
  const body = await response.json() as {
    root: string;
    entries: Array<{ name: string; type: string; children?: Array<{ name: string }> }>;
  };
  assert.equal(body.root, realpathSync(workspace));
  assert.deepEqual(
    new Set(body.entries.map((entry) => entry.name)),
    new Set(["src", "README.md", "untracked.txt", "中文 文件.ts"]),
  );
  assert.deepEqual(body.entries[0].children?.map((entry) => entry.name), ["index.ts"]);
  assert.equal(body.entries.some((entry) => entry.name === ".git"), false);
});

test("workspace file returns readable text and rejects files outside the root", async () => {
  const response = await fetch(
    `${apiUrl}/v1/workspace/file?root=${encodeURIComponent(workspace)}&path=${encodeURIComponent("src/index.ts")}`,
  );
  assert.equal(response.status, 200);
  const body = await response.json() as { path: string; content: string; language: string };
  assert.equal(body.path, "src/index.ts");
  assert.match(body.content, /answer = 43/);
  assert.equal(body.language, "typescript");

  const rejected = await fetch(
    `${apiUrl}/v1/workspace/file?root=${encodeURIComponent(workspace)}&path=${encodeURIComponent("../secret")}`,
  );
  assert.equal(rejected.status, 403);
});

test("workspace review reports git changes and patch content", async () => {
  const response = await fetch(`${apiUrl}/v1/workspace/review?path=${encodeURIComponent(workspace)}`);
  assert.equal(response.status, 200);
  const body = await response.json() as {
    isGitRepository: boolean;
    files: Array<{ path: string; status: string }>;
    patch: string;
  };
  assert.equal(body.isGitRepository, true);
  assert.deepEqual(new Set(body.files.map((file) => `${file.status}:${file.path}`)), new Set([
    "M:src/index.ts",
    "??:untracked.txt",
    "??:中文 文件.ts",
  ]));
  assert.match(body.patch, /answer = 42/);
  assert.match(body.patch, /answer = 43/);
  assert.match(body.patch, /new review content/);
  assert.match(body.patch, /localized = true/);
});

test("workspace tree reports when deeper directories are omitted", async () => {
  const deep = join(workspace, "one", "two", "three", "four", "five");
  mkdirSync(deep, { recursive: true });
  writeFileSync(join(deep, "hidden.ts"), "export {};\n");
  const response = await fetch(`${apiUrl}/v1/workspace/tree?path=${encodeURIComponent(workspace)}`);
  assert.equal(response.status, 200);
  const body = await response.json() as { truncated: boolean };
  assert.equal(body.truncated, true);
});

test("workspace review truncates oversized patches without failing", async () => {
  writeFileSync(join(workspace, "src", "index.ts"), `export const large = "${"x".repeat(2_200_000)}";\n`);
  const response = await fetch(`${apiUrl}/v1/workspace/review?path=${encodeURIComponent(workspace)}`);
  assert.equal(response.status, 200);
  const body = await response.json() as { patch: string; patchTruncated: boolean };
  assert.equal(body.patchTruncated, true);
  assert.ok(Buffer.byteLength(body.patch) <= 2 * 1024 * 1024 + 1024);
});
