import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createTools } from "@pi-agent/agent";

// 回归测试：search_code 曾在 safeRegex 中使用 g 标志，
// 导致带 g 的正则跨行共享 lastIndex 状态、静默跳过匹配行。
// 修复后应命中工作区内所有包含 pattern 的行。
let workspace: string;

before(() => {
  workspace = mkdtempSync(join(tmpdir(), "pi-agent-search-"));
  mkdirSync(join(workspace, "src"));
  // 三个文件、每一行都包含 "answer"，共 5 处匹配。
  writeFileSync(
    join(workspace, "src", "alpha.ts"),
    "export const answerA = 1;\nexport const answerB = 2;\nexport const answerC = 3;\n",
  );
  writeFileSync(
    join(workspace, "src", "beta.ts"),
    "// answer appears here too\nexport const answerD = 4;\n",
  );
});

after(() => {
  rmSync(workspace, { recursive: true, force: true });
});

test("search_code finds every matching line across files", async () => {
  const tools = createTools(workspace);
  const search = tools.find((tool) => tool.name === "search_code");
  assert.ok(search, "search_code tool should exist");

  const output = await search!.run({ pattern: "answer" });

  assert.match(output, /alpha\.ts:1:/);
  assert.match(output, /alpha\.ts:2:/);
  assert.match(output, /alpha\.ts:3:/);
  assert.match(output, /beta\.ts:1:/);
  assert.match(output, /beta\.ts:2:/);
  assert.match(output, /找到 5 处/);
});
