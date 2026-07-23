/**
 *  GET /api/fs — 浏览本地文件系统
 *  ?path=/Users/moyizhi — 列出该目录下的文件和子目录
 *  只返回目录（用于项目目录选择），按名称排序
 */

import { NextRequest } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

export async function GET(req: NextRequest) {
  const rawDir = req.nextUrl.searchParams.get("path") || process.env.HOME || "/Users";
  const dir = rawDir.replace(/^~/, process.env.HOME || "/Users");

  // 安全检查：拒绝访问敏感路径
  const resolved = path.resolve(dir);
  if (resolved === "/" || resolved === "/etc" || resolved === "/var" || resolved === "/tmp") {
    return Response.json({ error: "不允许访问系统目录" }, { status: 403 });
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: path.join(resolved, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 父目录
    const parent = path.dirname(resolved);
    const breadcrumb = resolved === "/" ? [] : resolved.split("/").filter(Boolean).reduce<{ name: string; path: string }[]>(
      (acc, part) => {
        const p = acc.length === 0 ? `/${part}` : `${acc[acc.length - 1].path}/${part}`;
        acc.push({ name: part, path: p });
        return acc;
      },
      []
    );

    return Response.json({
      current: resolved,
      parent: parent !== resolved ? parent : null,
      breadcrumb,
      dirs,
    });
  } catch {
    return Response.json({ error: "无法读取目录" }, { status: 404 });
  }
}
