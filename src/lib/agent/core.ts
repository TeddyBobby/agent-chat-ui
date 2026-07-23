/**
 *  core.ts — PiAgent 框架核心（原生 function calling 版）
 *
 *  不再依赖文本解析，用 OpenAI 原生 tool_calls 机制。
 *  DeepSeek / Ollama / OpenAI 通用。
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
  type: "thought" | "action" | "observation" | "answer";
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
  private config: Required<AgentConfig>;
  private onStep: StepCallback | null = null;

  constructor(config: AgentConfig) {
    this.config = {
      baseURL: "https://api.openai.com/v1",
      maxSteps: 25,
      systemPrompt: "",
      ...config,
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
    const messages: Message[] = [
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
        this.emit({ type: "answer", content: answer });
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

    // Step 2: fetch
    let res: Response;
    try {
      // 构建安全的 headers — 确保所有值都是纯 ASCII
      const hdrs = new Headers();
      hdrs.set("Content-Type", "application/json");
      if (this.config.apiKey) {
        // 去除 API key 中的非 ASCII 字符，避免 ByteString 错误
        const safeKey = this.config.apiKey.replace(/[^\x00-\x7F]/g, "");
        hdrs.set("Authorization", `Bearer ${safeKey}`);
      }
      res = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: "POST",
        headers: hdrs,
        body: new Uint8Array(bodyBytes),
      });
    } catch (e: any) {
      throw new Error(`[step2 fetch] ${e.message}`);
    }

    // Step 3: read response
    if (!res.ok) {
      try {
        const text = await res.text();
        throw new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`);
      } catch (e: any) {
        if (e.message.startsWith("LLM API")) throw e;
        throw new Error(`[step3 error-text] ${e.message}`);
      }
    }

    // Step 4: parse JSON
    try {
      return res.json();
    } catch (e: any) {
      throw new Error(`[step4 json parse] ${e.message}`);
    }
  }

  private emit(event: StepEvent) {
    this.onStep?.(event);
  }
}
