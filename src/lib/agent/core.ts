/**
 *  core.ts — PiAgent 框架核心（原生 function calling 版）
 *
 *  不再依赖文本解析，用 OpenAI 原生 tool_calls 机制。
 *  DeepSeek / Ollama 通用。
 */

// ==========================================================
// 类型
// ==========================================================

export interface ToolSchema {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

export interface Tool {
  name: string;
  description: string;
  schema: ToolSchema;
  run(args: Record<string, unknown>): Promise<string>;
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  maxSteps?: number;
  systemPrompt?: string;
  abortSignal?: AbortSignal;
  contextLimit?: number;
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface StepEvent {
  type: "thought" | "action" | "observation" | "answer" | "text_chunk";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export type StepCallback = (event: StepEvent) => void;

// ==========================================================
// System Prompt
// ==========================================================

function buildPrompt(tools: Tool[], custom?: string): string {
  if (custom) return custom;

  const toolList = tools.map((t) => `- **${t.name}**: ${t.description}`).join("\n");

  return `你是一个 coding agent。你可以使用工具来读写文件、搜索代码、执行命令。

## 可用工具
${toolList}

## 工作方式
- 使用工具读取项目文件，了解代码结构
- 使用 write_file 创建或修改文件。HTML/CSS/JS 等网页文件请放在 public/ 目录下，这样可以通过 http://localhost:3001/文件名 直接访问
- 使用 search_code 搜索代码库
- 使用 run_command 执行命令
- 使用 edit_file 精准编辑已有文件，避免全量重写
- 完成任务后简要总结你做了什么`;
}

// ==========================================================
// PiAgent
// ==========================================================

export class PiAgent {
  private tools = new Map<string, Tool>();
  private config: Required<Omit<AgentConfig, 'abortSignal'>> & Pick<AgentConfig, 'abortSignal'>;
  private onStep: StepCallback | null = null;
  private streamedText = false;

  constructor(config: AgentConfig) {
    this.config = {
      baseURL: "https://api.openai.com/v1",
      maxSteps: 60,
      systemPrompt: "",
      ...config,
      abortSignal: config.abortSignal ?? undefined,
      contextLimit: config.contextLimit ?? 128000,
    };
  }

  use(tool: Tool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  on(event: StepCallback): this {
    this.onStep = event;
    return this;
  }

  async run(
    task: string,
    history?: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<string> {
    const toolList = Array.from(this.tools.values());
    let messages: Message[] = [
      { role: "system", content: buildPrompt(toolList, this.config.systemPrompt) },
    ];

    // 注入对话历史（不包含最后一次用户消息，那由 task 提供）
    if (history && history.length > 0) {
      const contextMsg = history
        .map((m) => `[${m.role === "user" ? "用户" : "AI"}]: ${m.content}`)
        .join("\n\n");
      messages.push({
        role: "user",
        content: `以下是之前的对话历史，供你了解上下文：\n\n${contextMsg}\n\n---\n当前任务：${task}`,
      });
    } else {
      messages.push({ role: "user", content: task });
    }

    const openaiTools = toolList.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema,
      },
    }));

    for (let step = 0; step < this.config.maxSteps; step++) {
      // 上下文压缩：超过 75% 窗口时压缩中间轮次
      if (this.config.contextLimit && step > 0 && step % 5 === 0) {
        const tokens = this._estimateTokens(messages);
        if (tokens > this.config.contextLimit * 0.75) {
          messages = await this._compressContext(messages);
        }
      }

      // 客户端断开连接时中止
      if (this.config.abortSignal?.aborted) {
        this.emit({ type: "answer", content: "已取消（客户端断开）" });
        return "已取消";
      }
      this.streamedText = false;
      const data = await this.callLLM(messages, openaiTools);
      const msg: Message = data.choices[0].message;

      // 有 tool_calls → 执行
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg);

        for (const tc of msg.tool_calls) {
          const tool = this.tools.get(tc.function.name);
          if (!tool) {
            const errMsg = `工具 "${tc.function.name}" 不存在`;
            messages.push({ role: "tool", tool_call_id: tc.id, content: errMsg });
            this.emit({ type: "observation", content: errMsg, toolName: tc.function.name });
            continue;
          }

          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            const errMsg = `无法解析参数: ${tc.function.arguments.slice(0, 200)}`;
            messages.push({ role: "tool", tool_call_id: tc.id, content: errMsg });
            this.emit({ type: "observation", content: errMsg, toolName: tc.function.name });
            continue;
          }

          this.emit({
            type: "action",
            content: `调用 ${tc.function.name}`,
            toolName: tc.function.name,
            toolArgs: args,
          });

          // 让 SSE 先发送 tool_call，前端渲染 running spinner
          await new Promise(r => setTimeout(r, 50));

          try {
            const result = await tool.run(args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: result });
            this.emit({ type: "observation", content: result, toolName: tc.function.name });
          } catch (e: any) {
            const errMsg = `工具异常: ${e.message}`;
            messages.push({ role: "tool", tool_call_id: tc.id, content: errMsg });
            this.emit({ type: "observation", content: errMsg, toolName: tc.function.name });
          }
        }
        continue;
      }

      // 没有 tool_calls → 最终回答
      const answer = msg.content || "";
      if (answer) {
        this.emit({ type: "thought", content: "任务完成" });
        // 流式模式下文本已通过 text_chunk 发送,不再重复
        if (!this.streamedText) {
          this.emit({ type: "answer", content: answer });
        }
      }
      return answer;
    }

    const msg = `未完成：已达最大步数 ${this.config.maxSteps}`;
    this.emit({ type: "answer", content: msg });
    return msg;
  }

  private async callLLM(
    messages: Message[],
    tools: Array<{
      type: "function";
      function: { name: string; description: string; parameters: ToolSchema };
    }>
  ): Promise<any> {
    const body: any = {
      model: this.config.model,
      messages,
      temperature: 0,
      stream: true,
    };
    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    // Step 1: encode body
    let bodyBytes: Buffer;
    try {
      bodyBytes = Buffer.from(JSON.stringify(body), "utf-8");
    } catch (e: any) {
      throw new Error(`[step1 body encode] ${e.message}`);
    }

    // Step 2: fetch with streaming
    let res: Response;
    try {
      const hdrs = new Headers();
      hdrs.set("Content-Type", "application/json");
      if (this.config.apiKey) {
        const safeKey = this.config.apiKey.replace(/[^\x00-\x7F]/g, "");
        hdrs.set("Authorization", `Bearer ${safeKey}`);
      }
      // 智能路径：如果 baseURL 已包含 /responses 或 /chat/completions，直接用
      // 否则默认追加 /chat/completions（OpenAI 兼容）
      const hasExplicitPath = /\/(responses|chat\/completions)$/.test(this.config.baseURL || "");
      const endpoint = hasExplicitPath
        ? this.config.baseURL!
        : `${this.config.baseURL}/chat/completions`;
      res = await fetch(endpoint, {
        method: "POST",
        headers: hdrs,
        body: new Uint8Array(bodyBytes),
        signal: this.config.abortSignal,
      });
    } catch (e: any) {
      throw new Error(`[step2 fetch] ${e.message}`);
    }

    if (!res.ok) {
      try {
        const text = await res.text();
        throw new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`);
      } catch (e: any) {
        if (e.message.startsWith("LLM API")) throw e;
        throw new Error(`[step3 error-text] ${e.message}`);
      }
    }

    // Guard: 非 SSE 响应（代理返回 HTML 登录页等）要明确报错
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/event-stream")) {
      const preview = (await res.text()).slice(0, 200);
      throw new Error(`非流式响应 (${ct}): ${preview}`);
    }

    // Step 3: read SSE stream
    const reader = res.body?.getReader();
    if (!reader) throw new Error("[step3] No response body reader");

    const decoder = new TextDecoder();
    let textContent = "";
    const toolCallAcc = new Map<number, { id: string; name: string; args: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;

          let parsed: any;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            continue; // skip malformed chunks
          }

          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Text chunk → stream to frontend immediately
          if (delta.content) {
            const txt = String(delta.content);
            textContent += txt;
            this.streamedText = true;
            this.emit({ type: "text_chunk", content: txt });
          }

          // Tool call accumulation
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallAcc.has(idx)) {
                toolCallAcc.set(idx, {
                  id: tc.id || "",
                  name: tc.function?.name || "",
                  args: "",
                });
              }
              const acc = toolCallAcc.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }
        }
      }
    } catch (e: any) {
      throw new Error(`[step3 stream read] ${e.message}`);
    } finally {
      try { reader.cancel(); } catch {}
    }

    // Build final response in OpenAI format
    const finalToolCalls =
      toolCallAcc.size > 0
        ? Array.from(toolCallAcc.values()).map((tc) => ({
            id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.args },
          }))
        : undefined;

    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: textContent || null,
            ...(finalToolCalls ? { tool_calls: finalToolCalls } : {}),
          },
        },
      ],
    };
  }

  private emit(event: StepEvent) {
    this.onStep?.(event);
  }

  /** 估算消息列表的 token 数 */
  private _estimateTokens(messages: Message[]): number {
    let chars = 0;
    for (const m of messages) {
      chars += m.content.length + 4; // +4 role 标记开销
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          chars += JSON.stringify(tc.function.arguments || "").length;
        }
      }
    }
    return Math.ceil(chars / 2.5);
  }

  /** 压缩上下文：用 LLM 摘要中间轮次，保护 system + 尾部 */
  private async _compressContext(messages: Message[]): Promise<Message[]> {
    const contextLimit = this.config.contextLimit!;
    const threshold = Math.floor(contextLimit * 0.75);
    const tailBudget = Math.floor(contextLimit * 0.3); // 30% 留给尾部
    const summaryBudget = Math.floor(contextLimit * 0.1); // 10% 用于摘要本身

    // 找到 system prompt
    const sysIdx = messages.findIndex(m => m.role === "system");
    const systemTokens = sysIdx >= 0 ? this._estimateTokens([messages[sysIdx]]) : 0;

    // 从后往前收集尾部消息（保留最新上下文）
    const tail: Message[] = [];
    let tailTokens = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const cost = this._estimateTokens([messages[i]]);
      if (tailTokens + cost > tailBudget) break;
      tail.unshift(messages[i]);
      tailTokens += cost;
    }
    const tailStart = messages.length - tail.length;

    // 中间部分 = system 之后、尾部之前
    const middle = messages.slice(sysIdx + 1, tailStart);
    if (middle.length === 0) return messages;

    // 用 LLM 摘要中间部分
    const summaryPrompt =
      `Summarize the following conversation into a concise context summary. ` +
      `Keep all important facts, decisions, file changes, and error fixes. ` +
      `Format as bullet points. Be brief — this is for context compression, not a full report.\\n\\n` +
      middle.map(m => `[${m.role}] ${m.content.slice(0, 2000)}`).join("\\n\\n");

    try {
      const body = {
        model: this.config.model,
        messages: [{ role: "user", content: summaryPrompt }],
        temperature: 0,
        max_tokens: summaryBudget,
      };

      const hdrs = new Headers();
      hdrs.set("Content-Type", "application/json");
      if (this.config.apiKey) {
        hdrs.set("Authorization", `Bearer ${this.config.apiKey.replace(/[^\\x00-\\x7F]/g, "")}`);
      }

      const res = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: "POST",
        headers: hdrs,
        body: new Uint8Array(Buffer.from(JSON.stringify(body), "utf-8")),
        signal: this.config.abortSignal,
      });

      if (!res.ok) {
        // 压缩失败，回退为简单的旧消息截断
        return [messages[sysIdx], ...tail];
      }

      const data = await res.json();
      const summary = data.choices?.[0]?.message?.content || "";

      if (!summary) return messages;

      // 构建新消息列表: system + summary + tail
      const result: Message[] = [];
      if (sysIdx >= 0) result.push(messages[sysIdx]);
      result.push({
        role: "user",
        content:
          `[上下文摘要 — 以下是之前对话的关键信息，不是当前指令]\\n${summary}\\n\\n` +
          `--- 继续对话 ---`,
      });
      result.push(...tail);

      return result;
    } catch {
      // 压缩失败，回退：丢弃中间，只保留 system + tail
      const result: Message[] = [];
      if (sysIdx >= 0) result.push(messages[sysIdx]);
      result.push(...tail);
      return result;
    }
  }
}
