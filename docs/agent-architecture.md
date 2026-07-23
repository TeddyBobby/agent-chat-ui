# Agent 架构

PiAgent 是一个轻量级 ReAct Agent 框架，约 250 行 TypeScript，零框架依赖。

## 核心循环

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

## 核心抽象

**`Tool`** — 工具接口：

```ts
interface Tool {
  name: string;
  description: string;
  schema: ToolSchema;
  run(args: Record<string, unknown>): Promise<string>;
}
```

**`PiAgent`** — Agent 运行时：

```ts
const agent = new PiAgent({ apiKey, model, baseURL, maxSteps: 60 });
agent.use(readTool).use(writeTool).use(searchTool).use(execTool);
agent.on((event) => { /* 流式事件 → UI */ });
const answer = await agent.run("找出所有 TODO 注释");
```

工具是工作区感知的：`createTools(workdir) → [read_file, write_file, edit_file, search_code, run_command]`

## SSE 流式协议

```json
{"type":"start","workdir":"/Users/me/project"}
{"type":"tool_call","id":"tc-1","name":"read_file","args":{"path":"src/index.ts"}}
{"type":"tool_result","id":"tc-1","result":"[src/index.ts] L1-L50 / 200 行\n..."}
{"type":"text","content":"找到 5 个 TODO"}
{"type":"done"}
```

## LLM 流式调用

`callLLM()` 使用 `stream: true`，逐 token 解析 SSE chunk，实时发射 `text_chunk` 事件。工具调用按 `tc.index` 累积 arguments。

## 数据流

```
浏览器                          Next.js API Route                  LLM
──────                          ──────────────────                  ───
用户输入 ────────────────────►  POST /api/chat
                                │
                                ├─ createTools(projectDir)
                                ├─ new PiAgent(config)
                                ├─ agent.on(callback) ────► SSE 事件 ──► 浏览器渲染
                                └─ agent.run(task)
                                      │
                                      ├─ callLLM() ────────────► POST /chat/completions
                                      │                                 │
                                      │◄────────────────────────── tool_calls 或 text
                                      │
                                      └─ 循环直至完成或达到最大步数
```
