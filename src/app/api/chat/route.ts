/**
 *  POST /api/chat — PiAgent 驱动的 Agent 路由
 *
 *  接收前端消息 + workdir → 创建 PiAgent（带 coding 工具）→
 *  执行 ReAct 循环 → SSE 流式输出结构化事件
 */

import { NextRequest } from "next/server";
import { PiAgent } from "@/lib/agent/core";
import { createTools } from "@/lib/agent/tools";
import { AgentEvent } from "@/lib/types";
import { Readable } from "node:stream";

export async function POST(req: NextRequest) {
  const { messages, model, apiKey, baseUrl, workdir } = await req.json();

  const isDeepSeek = model?.startsWith("deepseek");
  const defaultBase = isDeepSeek
    ? process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"
    : process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  const apiBase = baseUrl || defaultBase;
  const key = apiKey || (isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY) || "";
  const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");

  if (!key && !isLocal) {
    return new Response(JSON.stringify({ error: "需要 API 密钥" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // workdir：~ 展开 + 自动创建
  const rawDir = (workdir || process.cwd()).replace(/^~/, process.env.HOME || "/Users");
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const projectDir = pathMod.resolve(rawDir);
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

  const userMessages = messages.filter((m: any) => m.role === "user");
  if (userMessages.length === 0) {
    return new Response(JSON.stringify({ error: "没有用户消息" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lastUserMsg = userMessages[userMessages.length - 1];
  const task = lastUserMsg.content;
  const lastUserIndex = messages.lastIndexOf(lastUserMsg);
  const history = messages
    .slice(0, lastUserIndex)
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({ role: m.role, content: m.content }));

  const agent = new PiAgent({
    apiKey: key,
    model: model || "gpt-4o",
    baseURL: apiBase,
    maxSteps: 12,
    systemPrompt: `你是一个 coding agent，当前工作目录是 ${projectDir}。所有文件路径都相对于这个目录。`,
  });

  for (const tool of createTools(projectDir)) agent.use(tool);

  // 使用 Node.js 原生 Readable stream，避免 Web ReadableStream 的 ByteString 问题
  const nodeStream = new Readable({ read() {} });

  function emit(event: AgentEvent) {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    nodeStream.push(line, "utf-8");
  }

  emit({ type: "start", workdir: projectDir });

  let lastToolCallId = "";

  agent.on((stepEvent) => {
    switch (stepEvent.type) {
      case "thought":
        break;
      case "action":
        lastToolCallId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        emit({
          type: "tool_call",
          id: lastToolCallId,
          name: stepEvent.toolName || "unknown",
          arguments: stepEvent.toolArgs || {},
        });
        break;
      case "observation":
        emit({ type: "tool_result", id: lastToolCallId, result: stepEvent.content });
        break;
      case "answer":
        emit({ type: "text", content: stepEvent.content });
        break;
    }
  });

  // 异步执行 agent，完成后关闭流
  agent
    .run(task, history.length > 0 ? history : undefined)
    .catch((e: any) => {
      console.error("[PiAgent]", e.stack);
      emit({ type: "error", message: `Agent 异常: ${e.message}` });
    })
    .finally(() => {
      emit({ type: "done" });
      nodeStream.push(null); // 关闭流
    });

  return new Response(nodeStream as any, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
