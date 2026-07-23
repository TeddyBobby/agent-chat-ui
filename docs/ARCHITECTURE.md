# PiAgent 架构文档

## 一、总览

PiAgent 是一个嵌入在 agent-chat-ui（Next.js 16）中的最小化 AI Coding Agent 框架。约 600 行 TypeScript，零外部 Agent 依赖，只依赖 `fetch` 调 LLM API 和 Node.js 标准库。

```
┌──────────────────────────────────────────────────────────┐
│                     浏览器 (React)                        │
│  page.tsx → chat-input.tsx → 发送消息到 /api/chat        │
│           → message-bubble.tsx ← SSE 流式渲染            │
└──────────────────────┬───────────────────────────────────┘
                       │ POST /api/chat
                       ▼
┌──────────────────────────────────────────────────────────┐
│              route.ts (API 路由 — SSE 桥梁)               │
│  1. 解析请求 → 提取 task + history                        │
│  2. new PiAgent() + 注册 5 个工具                         │
│  3. agent.on(stepEvent) → 转为 SSE chunk → 前端渲染       │
│  4. agent.run(task, history)                              │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              core.ts (Agent 引擎 — 233 行)                 │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │  System   │───▶│  LLM API │───▶│ tool_calls?      │   │
│  │  Prompt   │    │  (fetch) │    │  Yes → 执行工具   │   │
│  └──────────┘    └──────────┘    │  No  → 返回答案   │   │
│                                  └──────────────────┘   │
│                                         │                │
│                          ┌──────────────┘                │
│                          ▼                               │
│                  ┌──────────────┐                        │
│                  │  tools.ts    │                        │
│                  │  5 个工具     │                        │
│                  └──────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

### 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/lib/agent/core.ts` | 233 | Agent 引擎：类型、Prompt、主循环、LLM 调用 |
| `src/lib/agent/tools.ts` | 222 | 5 个内置工具：读/写/编辑/搜索/执行命令 |
| `src/app/api/chat/route.ts` | 143 | API 路由：HTTP → Agent → SSE 流式输出 |
| `src/lib/types.ts` | 41 | 前端类型定义（Conversation, Message, ToolCall 等） |

---

## 二、核心引擎 core.ts（233 行）

### 2.1 类型系统

```
Tool              ← 工具接口 { name, description, schema, run() }
  ├─ ToolSchema   ← JSON Schema { type, properties, required }
  │
AgentConfig       ← { apiKey, model, baseURL?, maxSteps?, systemPrompt? }
Message           ← { role, content, tool_call_id?, tool_calls?[] }
StepEvent         ← { type, content, toolName?, toolArgs? }   ← 流式回调事件
StepCallback      ← (event: StepEvent) => void
```

### 2.2 Tool 接口 — 框架的扩展点

```typescript
interface Tool {
  name: string;        // 工具名，LLM 通过这个名字调用
  description: string; // 告诉 LLM 这个工具干什么
  schema: {            // JSON Schema，LLM 据此生成参数
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  run(args): Promise<string>; // 实际执行逻辑，返回字符串结果
}
```

任何实现这个接口的对象都可以通过 `agent.use(tool)` 注册。框架不关心工具内部做什么——读文件、调 API、操作数据库都行。

### 2.3 System Prompt — buildPrompt()

```typescript
function buildPrompt(tools: Tool[], custom?: string): string
```

构造发送给 LLM 的第一条消息。包含：
- 角色定义：你是一个 coding agent
- 可用工具列表：从注册的 tools 中提取 name + description
- 工作方式指引：写文件放 public/、用 edit_file 精准编辑等

如果传入 `custom` 参数，跳过内置 prompt 直接用自定义的。

### 2.4 PiAgent 类 — 主循环

```
run(task, history?)
  │
  ├─ 1. 构建 messages 数组
  │     [system prompt] + [历史上下文] + [当前任务]
  │
  ├─ 2. 转换工具为 OpenAI function calling 格式
  │     Tool[] → [{ type: "function", function: { name, description, parameters } }]
  │
  └─ 3. ReAct 主循环 (最多 maxSteps=15 轮)
       │
       ├─ callLLM(messages, tools) → 调 /chat/completions
       │
       ├─ 响应有 tool_calls？
       │   ├─ YES → 遍历每个 tool_call
       │   │   ├─ 查找对应工具
       │   │   ├─ JSON.parse 参数
       │   │   ├─ emit("action") 通知回调
       │   │   ├─ tool.run(args) 执行
       │   │   ├─ emit("observation") 通知回调
       │   │   └─ 结果推入 messages (role: "tool")
       │   └─ continue 下一轮
       │
       └─ 响应无 tool_calls？
           └─ 返回 msg.content 作为最终答案
```

**关键设计**：
- 用 OpenAI 原生 `tool_calls` 机制，不走文本解析。LLM 的 API 响应里直接有结构化的 `tool_calls` 数组
- 工具执行结果通过 `role: "tool"` 消息喂回 LLM，LLM 据此决定下一步
- 每一步通过 `emit(StepEvent)` 通知外部（route.ts 将其转为 SSE）

### 2.5 callLLM() — 与 LLM 通信

```typescript
private async callLLM(messages, tools): Promise<any>
```

- 构建请求体：`{ model, messages, temperature: 0, tools, tool_choice: "auto" }`
- `temperature: 0`：确保确定性输出，工具调用不会随机波动
- `tool_choice: "auto"`：LLM 自己判断是否需要调工具
- POST 到 `{baseURL}/chat/completions`，兼容所有 OpenAI 格式 API

### 2.6 多轮对话支持 — history 参数

```typescript
run(task: string, history?: Array<{role, content}>): Promise<string>
```

有历史时，消息格式：
```
[用户]: 之前说了什么
[AI]: 之前回复了什么
---
当前任务：现在的需求
```

这样 Agent 知道前面创建过什么文件、做过什么修改，不需要用户重复描述。

---

## 三、工具系统 tools.ts（222 行）

### 3.1 read_file — 读文件

| 参数 | 类型 | 说明 |
|------|------|------|
| path | string | 文件路径 |
| offset | number | 起始行，默认 1 |
| limit | number | 行数，默认 200 |

返回格式：`[path] L1-L50 / 200 行` + 带行号的内容。

### 3.2 write_file — 写文件

| 参数 | 类型 | 说明 |
|------|------|------|
| path | string | 文件路径（相对路径自动 resolve 为绝对路径） |
| content | string | 完整内容 |

返回：`✅ 文件已创建: /absolute/path` + 行数/字节 + 前 15 行预览。

设计要点：
- `path.resolve()` 保证返回绝对路径
- 自动 `mkdirSync({ recursive: true })` 创建父目录
- 前 15 行预览直接嵌入返回结果，用户不用离开聊天就能看到内容

### 3.3 edit_file — 精准编辑（核心亮点）

| 参数 | 类型 | 说明 |
|------|------|------|
| path | string | 文件路径 |
| old_string | string | 要被替换的文本，必须在文件中唯一 |
| new_string | string | 替换后的文本 |

**为什么需要 edit_file**：write_file 是全量覆盖，编辑一行要重写整个文件——容易丢内容。edit_file 只替换匹配的片段。

**匹配策略**：
1. 精确匹配 `old_string` → 出现 1 次 → 替换
2. 出现 >1 次 → 报错，要求增加上下文
3. 出现 0 次 → 尝试 trim 后宽松匹配
4. trim 后有 1 次 → 替换（标注"宽松匹配"）
5. trim 后 0 次 → 返回错误 + 文件内容前 500 字符供调试

### 3.4 search_code — 搜索代码

| 参数 | 类型 | 说明 |
|------|------|------|
| pattern | string | 文本或正则 |
| dir | string | 目录，默认 . |
| fileGlob | string | 文件过滤，如 "*.ts" |

实现：递归遍历目录，跳过 `.` 开头目录和 `node_modules`，对每个文件逐行匹配。最多 50 个结果。

### 3.5 run_command — 执行命令

| 参数 | 类型 | 说明 |
|------|------|------|
| command | string | shell 命令 |
| workdir | string | 工作目录 |

安全限制：10 秒超时、输出截断 5000 字符、buffer 上限 10MB。

---

## 四、API 路由 route.ts（143 行）

### 4.1 请求处理流程

```
POST /api/chat { messages, model, apiKey, baseUrl }
  │
  ├─ 1. 提取配置：apiBase, key
  ├─ 2. 本地 API（localhost/127.0.0.1）免 key 检查
  ├─ 3. 提取任务：最后一条 user 消息 = task
  ├─ 4. 提取历史：task 之前的 user/assistant 消息 = history
  ├─ 5. new PiAgent(config) + 注册全部 5 个工具
  │
  └─ 6. 创建 SSE ReadableStream
       │
       ├─ agent.on(stepEvent) → 转为 markdown → emit(chunk)
       │   ├─ thought      → "> 🤔 ..."
       │   ├─ action       → "🔧 调用工具 + JSON 参数"
       │   ├─ observation  → "📋 结果" 或 "📄 文件已创建 + 内容预览"
       │   └─ answer       → "✅ 答案" + "📂 创建的文件列表"
       │
       └─ agent.run(task, history)
```

### 4.2 SSE 事件到 Markdown 的映射

| StepEvent.type | 前端显示 |
|----------------|----------|
| thought | `> 🤔 推理内容` |
| action | `**🔧 调用工具：\`toolName\`**` + JSON 参数代码块 |
| observation (write_file) | `### 📄 文件已创建` + 路径 + 内容预览代码块 |
| observation (其他) | `**📋 结果：**` + 结果代码块 |
| answer | `**✅** 答案正文` + 文件汇总列表 |

### 4.3 文件创建的特殊处理

当 `observation` 事件标记为 `write_file` 且内容匹配 `✅ 文件已创建: (.+)`：
1. 解析出绝对路径
2. 记录到 `createdFiles[]` 
3. 分离元信息（行数/字节）和内容预览
4. 分别用标题、行内代码、代码块展示

Answer 阶段汇总 `createdFiles` 列表，用户一目了然本轮创建了哪些文件。

---

## 五、前端类型 types.ts（41 行）

定义了聊天 UI 的数据结构：

```
Conversation { id, title, model, messages[], createdAt, updatedAt }
Message      { id, role, content, toolCalls?[], timestamp }
ToolCall     { id, name, arguments, result?, error?, status }
ModelInfo    { id, name, provider }
MODELS[]     → GPT-4o / Claude / DeepSeek / Gemini / Gemma4(本地)
```

注意：前端的 `ToolCall` 类型在当前版本中不再使用——Agent 的工具调用结果通过 SSE 内容流以 markdown 形式直接展示，不经过 ToolCall 结构。

---

## 六、完整数据流（一次请求的完整生命周期）

```
用户输入「创建 src/hello.ts，导出 greet 函数」
  │
  ▼
page.tsx: handleSend()
  → addMessage(userMsg)
  → addMessage(assistantMsg, content='')
  → fetch POST /api/chat { messages, model, baseUrl }
  │
  ▼
route.ts:
  task = "创建 src/hello.ts，导出 greet 函数"
  history = []  (首轮对话)
  new PiAgent({ model: "gemma4:e4b", baseURL: "http://localhost:11434/v1" })
  agent.use(readFileTool).use(writeFileTool)... 
  │
  ▼
core.ts: agent.run(task)
  messages = [
    { role: "system", content: "你是一个 coding agent..." }  ← buildPrompt()
    { role: "user",   content: "创建 src/hello.ts..." }
  ]
  │
  ▼ Step 1
callLLM() → POST http://localhost:11434/v1/chat/completions
  body: { model, messages, tools: [...5个工具], tool_choice: "auto" }
  │
  ▼ LLM 响应
{ choices: [{ message: {
    tool_calls: [{
      function: {
        name: "write_file",
        arguments: '{"path":"src/hello.ts","content":"export function greet()..."}'
      }
    }]
  }}]}
  │
  ▼ Agent 处理
tool = tools.get("write_file")
args = JSON.parse(arguments)  → { path: "src/hello.ts", content: "..." }
emit({ type: "action", toolName: "write_file", toolArgs: args })
  │
  ▼ 路由层
emit("🔧 调用工具：write_file\n```json\n{...}\n```")  → SSE chunk
  │
  ▼ 工具执行
writeFileTool.run(args)
  → fs.writeFileSync("/Users/.../src/hello.ts", content)
  → return "✅ 文件已创建: /Users/.../src/hello.ts\n3 行，61 字节\n\n--- 内容预览 ---\n..."
emit({ type: "observation", content: result, toolName: "write_file" })
  │
  ▼ 路由层
emit("### 📄 文件已创建\n`/Users/.../hello.ts`\n3 行，61 字节\n\n**内容预览：**\n```\nexport function greet()...\n```")
  │
  ▼ Step 2
messages.push({ role: "assistant", content: ..., tool_calls: [...] })
messages.push({ role: "tool", tool_call_id: "...", content: "✅ 文件已创建..." })
callLLM() → LLM 看到工具结果，决定是否继续
  │
  ▼ LLM 响应（无 tool_calls）
{ choices: [{ message: { content: "已在 src/hello.ts 中创建 greet 函数" } }]}
  │
  ▼ Agent 返回
emit({ type: "answer", content: "已在 src/hello.ts 中创建 greet 函数" })
return answer
  │
  ▼ 路由层
emit("### 📂 本轮创建的文件：\n- `/Users/.../hello.ts`\n")
emit("**✅** 已在 src/hello.ts 中创建 greet 函数")
controller.enqueue("data: [DONE]\n\n")
  │
  ▼ 前端
page.tsx: SSE stream → appendToMessage(convId, msgId, chunk)
message-bubble.tsx: ReactMarkdown 渲染带格式的内容
```

---

## 七、关键设计决策

### 为什么用 function calling 而不是文本解析？

版本 1 用文本 ReAct（Thought/Action/Action Input 正则匹配），DeepSeek 和 Gemma 不遵守格式，直接把代码写在 Final Answer 里。function calling 是 LLM 原生支持的机制，`tool_calls` 是结构化 JSON，不会出现格式错误。

### 为什么 temperature=0？

工具调用要求确定性和可预测性。temperature>0 可能导致同一问题两次调用不同工具，不可调试。

### 为什么 history 拼成文本而不是多轮 messages？

OpenAI 格式支持多轮 messages，但工具调用后需要 `role: "tool"` 消息携带 `tool_call_id`。历史对话中的 assistant 消息没有 `tool_calls` 字段（前端只存了纯文本 content），直接拼成 messages 数组会导致格式不匹配。所以折中方案：把历史文本化，注入到用户消息里。

### 为什么 edit_file 不用 diff/patch？

diff 格式对人类友好但对 LLM 而言复杂——LLM 需要精确计算行号偏移。`old_string → new_string` 查找替换对 LLM 更自然：它已经看过文件内容，知道要改哪一段，直接用原文匹配即可。

---

## 八、如何扩展

### 添加新工具

```typescript
import { Tool } from "./core";

export const myTool: Tool = {
  name: "my_tool",
  description: "工具描述",
  schema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "参数说明" },
    },
    required: ["param1"],
  },
  async run(args) {
    // 实现逻辑
    return "结果字符串";
  },
};

// 在 ALL_TOOLS 中注册
export const ALL_TOOLS: Tool[] = [..., myTool];
```

### 自定义 System Prompt

```typescript
const agent = new PiAgent({
  ...config,
  systemPrompt: "你是一个专注于 React 组件开发的 agent...",
});
```

### 更换 LLM Provider

```typescript
// OpenAI
new PiAgent({ model: "gpt-4o", baseURL: "https://api.openai.com/v1", apiKey })

// DeepSeek
new PiAgent({ model: "deepseek-chat", baseURL: "https://api.deepseek.com/v1", apiKey })

// Ollama (本地)
new PiAgent({ model: "gemma4:e4b", baseURL: "http://localhost:11434/v1", apiKey: "" })
```
