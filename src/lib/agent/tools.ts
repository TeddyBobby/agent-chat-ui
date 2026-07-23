/**
 *  tools.ts — PiAgent 内置 coding 工具（Next.js 版本）
 *
 *  ALL_TOOLS 改为工厂函数，接受 workdir 参数。
 *  所有相对路径都基于 workdir 解析，确保 agent 操作的是用户选定的项目目录。
 */

import { Tool } from "./core";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// ==========================================================
// 工厂函数：创建一组绑定到 workdir 的工具
// ==========================================================

export function createTools(workdir: string): Tool[] {
  const root = path.resolve(workdir || process.cwd());

  const resolvePath = (p: string) => path.isAbsolute(p) ? p : path.join(root, p);
  const relativePath = (p: string) => {
    const abs = resolvePath(p);
    return abs.startsWith(root) ? path.relative(root, abs) : abs;
  };

  // ---- 读文件 ----
  const readFileTool: Tool = {
    name: "read_file",
    description: "读取文件内容，支持行号范围",
    schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径（相对于项目根目录的路径，或绝对路径）" },
        offset: { type: "number", description: "起始行号，默认 1" },
        limit: { type: "number", description: "读取行数，默认 200" },
      },
      required: ["path"],
    },
    async run(args) {
      const fp = resolvePath(String(args.path));
      const offset = Number(args.offset ?? 1);
      const limit = Number(args.limit ?? 200);

      if (!fs.existsSync(fp)) return `错误：文件不存在 —— ${relativePath(fp)}`;

      const lines = fs.readFileSync(fp, "utf-8").split("\n");
      const end = Math.min(offset + limit, lines.length);
      const result = lines.slice(offset - 1, end);
      const header = `[${relativePath(fp)}] L${offset}-L${end} / ${lines.length} 行`;
      return [header, ...result.map((l, i) => `${offset + i}: ${l}`)].join("\n");
    },
  };

  // ---- 写文件 ----
  const writeFileTool: Tool = {
    name: "write_file",
    description: "写入文件（覆盖），自动创建父目录",
    schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径（相对于项目根目录）" },
        content: { type: "string", description: "要写入的完整内容" },
      },
      required: ["path", "content"],
    },
    async run(args) {
      const fp = resolvePath(String(args.path));
      const content = String(args.content);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, content, "utf-8");
      const lines = content.split("\n");
      const preview = lines.slice(0, 15).join("\n");
      const more = lines.length > 15 ? `\n...（共 ${lines.length} 行）` : "";
      return `✅ 文件已创建: ${relativePath(fp)}\n${lines.length} 行，${content.length} 字节\n\n--- 内容预览 ---\n${preview}${more}`;
    },
  };

  // ---- 编辑文件 ----
  const editFileTool: Tool = {
    name: "edit_file",
    description: "精准编辑文件——查找并替换指定文本。old_string 必须在文件中唯一匹配",
    schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "要编辑的文件路径（相对于项目根目录）" },
        old_string: { type: "string", description: "要被替换的文本（必须唯一，建议带上下文行）" },
        new_string: { type: "string", description: "替换后的新文本" },
      },
      required: ["path", "old_string", "new_string"],
    },
    async run(args) {
      const fp = resolvePath(String(args.path));
      const oldStr = String(args.old_string);
      const newStr = String(args.new_string);

      if (!fs.existsSync(fp)) return `错误：文件不存在 —— ${relativePath(fp)}`;

      const content = fs.readFileSync(fp, "utf-8");

      let count = 0;
      let pos = 0;
      while ((pos = content.indexOf(oldStr, pos)) !== -1) { count++; pos++; }

      if (count === 0) {
        const trimmed = oldStr.trim();
        let tCount = 0;
        let tPos = 0;
        while ((tPos = content.indexOf(trimmed, tPos)) !== -1) { tCount++; tPos++; }
        if (tCount === 1) {
          fs.writeFileSync(fp, content.replace(trimmed, newStr), "utf-8");
          return `✅ 已编辑: ${relativePath(fp)}（宽松匹配）`;
        }
        return `错误：未找到匹配文本。\nold_string 前 100 字符：\n${oldStr.slice(0, 100)}\n\n文件前 500 字符：\n${content.slice(0, 500)}`;
      }

      if (count > 1) {
        return `错误：old_string 出现了 ${count} 次，不唯一。请增加更多上下文行。`;
      }

      fs.writeFileSync(fp, content.replace(oldStr, newStr), "utf-8");
      return `✅ 已编辑: ${relativePath(fp)}\n替换了 1 处匹配`;
    },
  };

  // ---- 搜索代码 ----
  const searchCodeTool: Tool = {
    name: "search_code",
    description: "搜索代码库中的文本或正则，返回匹配文件和行",
    schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "搜索文本或正则" },
        dir: { type: "string", description: "搜索目录，默认项目根" },
        fileGlob: { type: "string", description: '文件过滤，如 "*.ts"' },
      },
      required: ["pattern"],
    },
    async run(args) {
      const pattern = String(args.pattern);
      const dir = resolvePath(String(args.dir ?? "."));
      const glob = args.fileGlob ? String(args.fileGlob) : null;
      if (!fs.existsSync(dir)) return `错误：目录不存在 —— ${relativePath(dir)}`;

      const results: string[] = [];
      const re = safeRegex(pattern);

      function walk(d: string) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) {
            if (!e.name.startsWith(".") && e.name !== "node_modules") walk(full);
          } else if (e.isFile()) {
            if (glob && !matchGlob(e.name, glob)) continue;
            try {
              const lines = fs.readFileSync(full, "utf-8").split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (re.test(lines[i])) {
                  results.push(`${relativePath(full)}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
                  if (results.length >= 50) return;
                }
              }
            } catch { /* skip binary */ }
          }
        }
      }
      walk(dir);
      return results.length === 0
        ? `未找到匹配 "${pattern}" 的结果`
        : [`找到 ${results.length} 处：`, ...results].join("\n");
    },
  };

  // ---- 执行命令 ----
  const runCommandTool: Tool = {
    name: "run_command",
    description: "执行 shell 命令（10s 超时，输出截断 5000 字符）。工作目录为项目根目录。",
    schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "要执行的命令" },
        workdir: { type: "string", description: "工作目录，相对于项目根（可选，默认项目根）" },
      },
      required: ["command"],
    },
    async run(args) {
      const cmd = String(args.command);
      const cwd = args.workdir ? resolvePath(String(args.workdir)) : root;
      try {
        const stdout = execSync(cmd, {
          cwd, timeout: 10_000, encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        });
        const t = stdout.slice(0, 5000);
        return t + (stdout.length > 5000 ? `\n...（共 ${stdout.length} 字符）` : "") || "(无输出)";
      } catch (e: any) {
        return `命令失败 (exit ${e.status ?? "?"}):\n${String(e.stdout ?? e.stderr ?? e.message).slice(0, 2000)}`;
      }
    },
  };

  return [readFileTool, writeFileTool, editFileTool, searchCodeTool, runCommandTool];
}

// 向后兼容：默认工作目录为 process.cwd()
export const ALL_TOOLS: Tool[] = createTools(process.cwd());

// ---- 辅助 ----
function safeRegex(p: string): RegExp {
  try { return new RegExp(p, "gi"); } catch {
    return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  }
}

function matchGlob(name: string, glob: string): boolean {
  return new RegExp("^" + glob.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i").test(name);
}
