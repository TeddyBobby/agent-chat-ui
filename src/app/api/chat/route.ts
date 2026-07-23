/**
 *  POST /api/chat — Agent 路由
 *
 *  接收前端消息 + workdir → 创建 PiAgent → 执行 ReAct 循环 →
 *  SSE 流式输出结构化事件到浏览器
 *
 *  支持两种模式：
 *  1. 代理模式：前端传了 baseUrl → 所有模型都走这个代理地址
 *  2. 直连模式：不传 baseUrl → 走模型自带 baseUrl 或环境变量默认值
 */

import { NextRequest } from "next/server";
import { PiAgent } from "@/lib/agent/core";
import { createTools } from "@/lib/agent/tools";
import { AgentEvent } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { messages, model, apiKey, baseUrl, workdir, contextLimit } = await req.json();

  // ═══ 智能 URL 解析 ═══
  // 优先级：用户自定义 > 环境变量 > 直连默认
  let apiBase: string;
  if (baseUrl) {
    // 代理模式：直接用用户填的地址
    apiBase = baseUrl;
  } else {
    // 直连模式：按 provider 区分
    const isDeepSeek = model?.startsWith("deepseek");
    const isOllama = model?.includes(":");
    if (isOllama) {
      apiBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
    } else if (isDeepSeek) {
      apiBase = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
    } else {
      apiBase = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    }
  }

  // ═══ API Key ═══
  // 优先级：用户自定义 > 环境变量
  let key: string;
  if (apiKey) {
    key = apiKey;
  } else {
    const isDeepSeek = model?.startsWith("deepseek");
    key = (isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY) || "";
  }

  const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");

  if (!key && !isLocal) {
    return new Response(JSON.stringify({ error: "需要 API 密钥" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ═══ workdir 处理 ═══
  const rawDir = (workdir || process.cwd()).replace(/^~/, process.env.HOME || "/Users");
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const projectDir = pathMod.resolve(rawDir);
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

  // ═══ 消息处理 ═══
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

  // ═══ 创建 Agent ═══
  console.log(`[PiAgent] → ${apiBase} model=${model} workdir=${projectDir}`);
  const agent = new PiAgent({
    apiKey: key,
    model: model || "gpt-4o",
    baseURL: apiBase,
    maxSteps: 60,
    abortSignal: req.signal,
    contextLimit: contextLimit || 128000,
    systemPrompt: `你是一个 coding agent，当前工作目录是 ${projectDir}。所有文件路径都相对于这个目录。`,
  });

  for (const tool of createTools(projectDir)) agent.use(tool);

  // ═══ SSE 流式输出 ═══
  const encoder = new TextEncoder();
  let done = false;
  const stream = new ReadableStream({
    start(controller) {
      function emit(event: AgentEvent) {
        if (done) return;
        const line = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(line));
      }

      emit({ type: "start", workdir: projectDir });

      let lastToolCallId = "";

      agent.on((stepEvent) => {
        if (done) return;
        try {
          switch (stepEvent.type) {
            case "thought":
              break;
            case "text_chunk":
              emit({ type: "text", content: stepEvent.content });
              break;
            case "action":
              lastToolCallId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              emit({
                type: "tool_call",
                id: lastToolCallId,
                name: stepEvent.toolName || "unknown",
                args: stepEvent.toolArgs || {},
              });
              break;
            case "observation":
              emit({ type: "tool_result", id: lastToolCallId, result: stepEvent.content });
              break;
            case "answer":
              emit({ type: "text", content: stepEvent.content });
              break;
          }
        } catch {
          // emit 失败不影响 agent 循环
        }
      });

      agent
        .run(task, history.length > 0 ? history : undefined)
        .catch((e: any) => {
          console.error("[PiAgent]", e.stack);
          try { emit({ type: "error", message: `Agent 异常: ${e.message}` }); } catch {}
        })
        .finally(() => {
          try { emit({ type: "done" }); } catch {}
          try { controller.close(); } catch {}
        });
    },
    cancel() {
      done = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
