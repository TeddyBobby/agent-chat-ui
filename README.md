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
