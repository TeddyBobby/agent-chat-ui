# {{Pi}}Agent — AI 编程助手

基于 PiAgent 框架的 AI 编程助手界面。对话式操作文件系统，实时观看工具执行过程。

Next.js + TypeScript + Tailwind CSS 构建。

![{{Pi}}Agent](public/screenshot.png)

## 功能

- **Agent 编程** — 在项目目录中读、写、编辑、搜索文件，执行命令
- **项目目录选择** — 内置文件浏览器，选择任意目录作为工作区
- **结构化流式输出** — 工具调用以实时卡片展示（执行中 / 已完成 / 失败）
- **文件上传** — 拖拽或选择文件，文本文件带行号预览，非文本文件只显示图标
- **多模型支持** — OpenAI、DeepSeek、Ollama 或任意兼容 OpenAI 格式的 API
- **Markdown 渲染** — GFM 表格、代码块语法高亮
- **设置持久化** — 模型、API Key、项目目录刷新后自动恢复
- **暗色主题** — zinc 色调 premium 暗色设计

## 快速开始

```bash
git clone https://github.com/TeddyBobby/agent-chat-ui.git
cd agent-chat-ui
npm install
npm run dev
```

打开 http://localhost:3001，点击底部模型名称展开设置，选择模型并输入 API Key。

### 本地模型 (Ollama)

```bash
ollama pull gemma4
npm run dev
```

模型下拉选择「Gemma 4 (本地)」，无需 API Key。

### DeepSeek

1. 从 [platform.deepseek.com](https://platform.deepseek.com) 获取 API Key
2. 选择「DeepSeek V4 Flash」或「DeepSeek V4 Pro」
3. 输入 Key，自动保存

也可以在 `.env.local` 中设置 `DEEPSEEK_API_KEY`。

## 配置

复制 `.env.example` 为 `.env.local`：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 默认 API Key |
| `OPENAI_BASE_URL` | 自定义 API 地址（默认 `https://api.openai.com/v1`） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek 地址（默认 `https://api.deepseek.com/v1`） |

## 架构 — PiAgent 框架

{{Pi}}Agent 的核心是一个名为 **PiAgent** 的轻量级 Agent 框架。所有 Agent 逻辑约 250 行 TypeScript，零框架依赖，基于原生 function calling 实现 ReAct（推理 + 行动）循环。

### 核心循环

```
用户消息 → 系统提示词 + 工具定义 → LLM（function calling）
                                          │
                        ┌─────────────────┘
                        ▼
                LLM 返回 tool_calls？
                   │          │
                  YES         NO
                   │          │
                   ▼          ▼
              执行工具      最终回答
                   │
                   ▼
              工具结果
                   │
                   └──────→ 送回 LLM
                        （循环直到完成或达到最大步数）
```

### 核心抽象

**`Tool`** — 工具接口，所有工具必须实现：

```ts
interface Tool {
  name: string;                   // 工具名
  description: string;            // 描述（写入 system prompt）
  schema: ToolSchema;             // 参数 JSON Schema
  run(args: Record<string, unknown>): Promise<string>;  // 执行逻辑
}
```

**`PiAgent`** — Agent 运行时：

```ts
const agent = new PiAgent({ apiKey, model, baseURL, maxSteps });
agent.use(readTool).use(writeTool).use(searchTool).use(execTool);
agent.on((event) => { /* 流式事件 → UI */ });
const answer = await agent.run("找出所有 TODO 注释，生成报告");
```

1. 构建系统提示词，注入工具说明
2. 将消息 + 工具定义发送给 LLM（原生 function calling）
3. LLM 返回 `tool_calls` → 执行工具 → 将结果反馈给 LLM → 循环
4. LLM 返回纯文本 → 最终回答

**工具** 是工作区感知的。所有相对路径基于用户选择的项目目录解析：

```
createTools(workdir) → [read_file, write_file, edit_file, search_code, run_command]
```

### 流式协议

API 端点输出结构化的 SSE 事件，而非原始文本：

```
data: {"type":"start","workdir":"/Users/me/project"}
data: {"type":"tool_call","id":"tc-1","name":"read_file","arguments":{"path":"src/index.ts"}}
data: {"type":"tool_result","id":"tc-1","result":"[src/index.ts] L1-L50 / 200 行\n..."}
data: {"type":"tool_call","id":"tc-2","name":"write_file","arguments":{...}}
data: {"type":"tool_result","id":"tc-2","result":"✅ 文件已创建: report.md\n..."}
data: {"type":"text","content":"找到 5 个 TODO，报告已写入 report.md"}
data: {"type":"done"}
```

前端实时解析这些事件 — 工具调用以实时卡片形式出现，随结果返回从 ⏳ 执行中更新为 ✓ 已完成，最终文本通过 Markdown 渲染器流式展示。

### 流式渲染引擎（五层架构）

前端 SSE 处理采用五层架构，全部集中在 `src/lib/stream/engine.ts`：

```
┌────────────────────────────────────────────────┐
│ Layer 1: ConnectionManager                     │
│ 指数退避重连 · 抖动防雪崩 · 区分停止/断开      │
├────────────────────────────────────────────────┤
│ Layer 2: StreamBuffer                          │
│ 半包/粘包缓冲 · TextDecoder 多字节安全          │
├────────────────────────────────────────────────┤
│ Layer 3: RequestDedup                          │
│ 请求 ID 去重 · 顺序校验 · 丢弃过期请求          │
├────────────────────────────────────────────────┤
│ Layer 4: BatchRenderer (RAF)                   │
│ 双指针缓冲追赶 · requestAnimationFrame 批量更新  │
├────────────────────────────────────────────────┤
│ Layer 5: handleEvent 分发器                     │
│ text → 入队渲染 · tool_call → 即时更新 · done   │
└────────────────────────────────────────────────┘
```

#### Layer 1: ConnectionManager — 连接管理

指数退避 + 随机抖动，区分用户停止和网络断开：

```ts
class ConnectionManager {
  private retries = 0;
  private maxRetries = 3;
  private baseDelay = 1000;   // 1s → 2s → 4s → 8s (max 30s)
  private maxDelay = 30000;

  private backoff(): number {
    const exp = Math.min(this.baseDelay * 2 ** this.retries, this.maxDelay);
    return Math.round(exp * (0.75 + Math.random() * 0.5)); // ±25% 抖动
  }

  async fetch(url, body, signal: AbortSignal) {
    while (this.retries <= this.maxRetries) {
      try {
        return await fetch(url, { method: 'POST', body: JSON.stringify(body), signal });
      } catch (e) {
        if (e.name === 'AbortError') throw e;  // 用户停止，不重试
        this.retries++;
        if (this.retries > this.maxRetries) throw e;
        await sleep(this.backoff());
      }
    }
  }
}
```

#### Layer 2: StreamBuffer — 数据接收

buffer 累积处理 TCP 半包/粘包，TextDecoder 防止中文 emoji 被截断：

```ts
class StreamBuffer {
  private decoder = new TextDecoder();
  private buffer = '';

  feed(chunk: Uint8Array): string[] {
    // stream:true 确保 \xe4\xb8 不会在"中"字中间截断
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';  // 不完整行保留
    return lines.filter(l => l.startsWith('data: ')).map(l => l.slice(6));
  }
}
```

#### Layer 3: RequestDedup — 去重校验

每次请求生成唯一 ID，处理时校验是否过期：

```ts
class RequestDedup {
  private currentRequestId: string | null = null;

  newRequest() {
    this.currentRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.currentRequestId;
  }

  isStale(requestId: string) {
    return this.currentRequestId !== null && requestId !== this.currentRequestId;
  }
}
```

#### Layer 4: BatchRenderer — RAF 批量渲染

文本块入队，同一帧内合并同 msgId 的连续块，一次 store 写入 + 一次 React 重渲染：

```ts
class BatchRenderer {
  private pending: Array<{ convId, msgId, chunk }> = [];
  private rafId: number | null = null;

  append(convId, msgId, chunk) {
    this.pending.push({ convId, msgId, chunk });
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();  // 合并 → appendToMessage → onTick (1次 React 更新)
      });
    }
  }

  private flush() {
    const batches = new Map<string, string>();
    for (const p of this.pending) {
      batches.set(p.msgId, (batches.get(p.msgId) || '') + p.chunk);
    }
    this.pending = [];
    for (const [msgId, text] of batches) appendToMessage(convId, msgId, text);
    this.onTick();
  }
}
```

#### Layer 5: 主控器

串联四层 + SSE 事件分发。`page.tsx` 只需调用 `stream.send()`：

```ts
const stream = createAgentStream({
  onTick: () => { setTick(t => t + 1); refreshConversations(); },
});
stream.send({ convId, assistantMsgId, messages, model, apiKey, baseUrl, workdir });

// 多会话并发 — 每会话独立 stream
const streamRef = useRef<Map<string, Stream>>(new Map());
streamRef.current.set(convId, stream);

// 只禁用正在运行的会话的输入框
<ChatInput disabled={!!runningConvId && runningConvId === activeId} />
```

#### 运行中工具可见性

工具执行通常在 1-2ms 内完成，需要两端 yield 才能看到 running spinner：

```ts
// 服务端 core.ts — emit action 后等 50ms 再执行工具
this.emit({ type: "action", ... });
await new Promise(r => setTimeout(r, 50));
const result = await tool.run(args);

// 客户端 engine.ts — 收到 tool_call 后 RAF yield
if (event.type === 'tool_call') await new Promise(r => requestAnimationFrame(r));
```

### 数据流

```
浏览器                          Next.js API Route                  LLM
──────                          ──────────────────                  ───
用户输入 ────────────────────►  POST /api/chat
                                │
                                ├─ createTools(projectDir)
                                ├─ new PiAgent(config)
                                ├─ agent.on(callback) ────► 发射 SSE 事件 ──► 浏览器渲染
                                └─ agent.run(task)
                                      │
                                      ├─ callLLM() ──────────────────────► POST /chat/completions
                                      │                                           │
                                      │◄────────────────────────────────── tool_calls 或 text
                                      │
                                      ├─ 执行工具（read/write/search/exec）
                                      │
                                      └─ 循环直至完成或达到最大步数
```

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts   # SSE 流式 Agent 端点
│   │   └── fs/route.ts     # 文件系统浏览 API
│   ├── layout.tsx
│   ├── page.tsx            # 主聊天页 + SSE 事件处理
│   └── globals.css
├── components/chat/
│   ├── chat-input.tsx      # 输入框 + 文件上传 + 设置
│   ├── directory-picker.tsx # 文件系统浏览弹窗
│   ├── message-list.tsx
│   ├── message-bubble.tsx  # 消息 + 文件卡片 + 工具摘要
│   ├── sidebar.tsx
│   └── tool-call-card.tsx  # 紧凑可折叠工具卡片
├── lib/
│   ├── agent/
│   │   ├── core.ts         # PiAgent: ReAct 循环 + function calling
│   │   └── tools.ts        # read_file、write_file、edit_file、search_code、run_command
│   ├── stream/
│   │   └── engine.ts       # 流式渲染引擎（五层架构）
│   ├── store.ts            # localStorage 持久化
│   └── types.ts            # 类型定义 + 模型注册 + SSE 事件类型
```

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router + Turbopack) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| 流式 | SSE (Server-Sent Events) + Node.js Readable |
| 存储 | localStorage |

## License

MIT © [TeddyBobby](https://github.com/TeddyBobby)
