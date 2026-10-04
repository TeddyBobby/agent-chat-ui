import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createTools } from "@pi-agent/agent";

// 回归测试：两个上下文预算相关的工具边界。
// 1) read_file 曾把 `limit` 当成「结束行号」而非「读取行数」，多读一行（off-by-one）。
// 2) search_code 的结果上限 50 曾只在单次 walk 调用内 return，父目录仍会继续递归兄弟目录，
//    导致结果突破 50 且继续扫描剩余文件、浪费上下文 token。

let workspace: string;

before(() => {
  workspace = mkdtempSync(join(tmpdir(), "pi-agent-tool-bounds-"));
  // 10 行文件（无尾随换行，保证 split 后恰好 10 行）。
  writeFileSync(
    join(workspace, "sample.txt"),
    Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join("\n"),
  );
  // 两个子目录，各含 60 行匹配，共 120 处匹配 → 应被上限截断为 50。
  for (const sub of ["a", "b"]) {
    const dir = join(workspace, sub);
    mkdirSync(dir);
    writeFileSync(
      join(dir, "many.ts"),
      Array.from({ length: 60 }, (_, i) => `export const needle${i} = ${i};`).join("\n"),
    );
  }
});

after(() => {
  rmSync(workspace, { recursive: true, force: true });
});

test("read_file returns exactly `limit` lines", async () => {
  const tools = createTools(workspace);
  const read = tools.find((tool) => tool.name === "read_file");
  assert.ok(read, "read_file tool should exist");

  const fromStart = await read!.run({ path: "sample.txt", offset: 1, limit: 3 });
  assert.match(fromStart, /L1-L3 \/ 10 行/);
  assert.match(fromStart, /3: line3/);
  assert.doesNotMatch(fromStart, /4: line4/);

  const fromMiddle = await read!.run({ path: "sample.txt", offset: 5, limit: 3 });
  assert.match(fromMiddle, /L5-L7 \/ 10 行/);
  assert.match(fromMiddle, /7: line7/);
  assert.doesNotMatch(fromMiddle, /8: line8/);
});

test("read_file clamps invalid offset/limit to safe bounds", async () => {
  const tools = createTools(workspace);
  const read = tools.find((tool) => tool.name === "read_file");
  assert.ok(read, "read_file tool should exist");

  // offset=0 / 负数 → 应从第一行开始读，而不是 slice(-1,…) 从最后一行开始。
  const zero = await read!.run({ path: "sample.txt", offset: 0, limit: 3 });
  assert.match(zero, /L1-L3 \/ 10 行/);
  assert.doesNotMatch(zero, /10: line10/);

  const negative = await read!.run({ path: "sample.txt", offset: -2, limit: 3 });
  assert.match(negative, /L1-L3 \/ 10 行/);

  // limit=0 / 负数 → 至少读一行，而不是返回空结果。
  const zeroLimit = await read!.run({ path: "sample.txt", offset: 2, limit: 0 });
  assert.match(zeroLimit, /L2-L2 \/ 10 行/);
  assert.match(zeroLimit, /2: line2/);

  // 非数字 → 回退默认（offset 1 / limit 200，读到文件末尾）。
  const garbage = await read!.run({ path: "sample.txt", offset: "abc", limit: "xyz" });
  assert.match(garbage, /L1-L10 \/ 10 行/);
  assert.match(garbage, /10: line10/);

  // offset 超过文件行数 → 明确报错，而不是返回空结果。
  const beyond = await read!.run({ path: "sample.txt", offset: 999 });
  assert.match(beyond, /offset 999 超出文件行数（10 行）/);
});

test("search_code caps results at 50 across directories", async () => {
  const tools = createTools(workspace);
  const search = tools.find((tool) => tool.name === "search_code");
  assert.ok(search, "search_code tool should exist");

  const output = await search!.run({ pattern: "needle" });
  const lines = output.split("\n");
  assert.match(lines[0], /找到 50 处/);
  assert.equal(lines.length - 1, 50, "结果数应被截断为 50，而不是 120");
});
