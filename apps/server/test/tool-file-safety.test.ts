import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createTools } from "@pi-agent/agent";

// 回归测试：agent 工具对二进制/超大文件的防护。
// coding agent 指向真实项目时，目录里混有图片、字体、编译产物和 minify 后的 bundle。
// 旧实现 read_file/search_code 直接 readFileSync 全文：二进制解码成乱码浪费上下文 token，
// 超大文件一次性读入内存可能撑爆进程。修复后：
//   - read_file 对二进制文件明确报错
//   - search_code 跳过二进制文件、超大文件和产物目录（dist/build/...）

let workspace: string;

before(() => {
  workspace = mkdtempSync(join(tmpdir(), "pi-agent-file-safety-"));
  mkdirSync(join(workspace, "dist"));
  // 二进制文件（PNG 魔数 + NUL 字节）
  writeFileSync(join(workspace, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]));
  // 超大文本文件（> 256KB），search_code 应跳过而非读入内存
  writeFileSync(join(workspace, "huge.log"), "needle\n".repeat(50_000));
  // 超大文本文件（> 1MB），edit_file 应拒绝而非整读进内存
  writeFileSync(join(workspace, "giant.txt"), "x".repeat(1_000_001));
  // 产物目录里的源码文件，search_code 应忽略 dist/
  writeFileSync(join(workspace, "dist", "bundle.js"), "const needle = 1;\n");
  // 正常小文本文件，唯一应被命中的
  writeFileSync(join(workspace, "src.ts"), "const needle = 42;\n");
});

after(() => {
  rmSync(workspace, { recursive: true, force: true });
});

test("read_file refuses binary files with a clear error", async () => {
  const tools = createTools(workspace);
  const read = tools.find((tool) => tool.name === "read_file");
  assert.ok(read, "read_file tool should exist");

  const output = await read!.run({ path: "logo.png" });
  assert.match(output, /无法读取二进制文件/);
  assert.match(output, /logo\.png/);
});

test("search_code skips binary files, oversized files, and ignored dirs", async () => {
  const tools = createTools(workspace);
  const search = tools.find((tool) => tool.name === "search_code");
  assert.ok(search, "search_code tool should exist");

  const output = await search!.run({ pattern: "needle" });
  // 只应命中 src.ts：dist/ 被忽略，huge.log 超大被跳过，logo.png 二进制被跳过。
  assert.match(output, /找到 1 处/);
  assert.match(output, /src\.ts:1:/);
  assert.doesNotMatch(output, /bundle\.js/);
  assert.doesNotMatch(output, /huge\.log/);
  assert.doesNotMatch(output, /logo\.png/);
});

test("edit_file refuses binary and oversized files", async () => {
  const tools = createTools(workspace);
  const edit = tools.find((tool) => tool.name === "edit_file");
  assert.ok(edit, "edit_file tool should exist");

  const binary = await edit!.run({ path: "logo.png", old_string: "a", new_string: "b" });
  assert.match(binary, /无法编辑二进制文件/);
  assert.match(binary, /logo\.png/);

  const oversized = await edit!.run({ path: "giant.txt", old_string: "a", new_string: "b" });
  assert.match(oversized, /文件过大/);
  assert.match(oversized, /giant\.txt/);
});
