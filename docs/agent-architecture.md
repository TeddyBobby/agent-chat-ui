# Agent 运行时

`packages/agent` 是不依赖 React、HTTP Server 或 SQLite 的模型/工具运行时。`apps/server/src/run-manager.ts` 负责把它接入持久化任务系统。

## 核心接口

```ts
const agent = new PiAgent({
  apiKey,
  model,
  baseURL,
  maxSteps: 60,
  contextLimit: 128_000,
  abortSignal,
  systemPrompt,
});

for (const tool of createTools(workdir)) agent.use(tool);
agent.on(handleStepEvent);
await agent.run(task, history);
```

内置工具：

- `read_file`
- `write_file`
- `edit_file`
- `search_code`
- `run_command`

所有相对路径以会话的 `workdir` 为基准；在 Electron 中，未选择目录时默认使用用户 Documents 目录。

## 模型循环

```text
system + history + task
          │
          ▼
OpenAI-compatible /chat/completions (stream=true)
          │
          ├─ text delta ───────────────► assistant.delta
          │
          └─ tool_calls
                 │
                 ▼
          tool.started
                 │
           execute tool
                 │
                 ▼
          tool.completed
                 │
                 └──────── result 返回模型，进入下一步
```

流式响应中的 tool call arguments 会按照 `index` 累积，完成后再解析 JSON。模型没有返回工具调用时，当前回答完成；超过 `maxSteps`、请求失败或工具异常时由 `RunManager` 转换为终态事件。

## StepEvent 到 RunEvent

| Agent `StepEvent` | 持久化事件 |
|---|---|
| `text_chunk` | `assistant.delta` |
| `action` | `tool.started` |
| `observation` | `tool.completed` |
| 正常结束 | `run.completed` |
| 抛出异常 | `run.failed` |
| AbortSignal | `run.cancelled` |

`RunManager.publish()` 负责持久化后广播，Agent 本身不知道 SQLite 和 SSE。

## 模型地址与凭据

- DeepSeek 模型默认使用 `DEEPSEEK_BASE_URL` 或官方兼容地址。
- 其他远程模型使用请求中的 `baseUrl`、`OPENAI_BASE_URL` 或 OpenAI 默认地址。
- localhost/127.0.0.1 模型可不提供 API Key。
- 远程模型优先使用 CredentialVault 中保存的 Key，再回退到服务端环境变量。

## 中止语义

每个 active Run 对应一个 `AbortController`。关闭 SSE 不会触发它；`POST /v1/runs/:id/cancel` 会先写入 `cancelling`，再 abort 模型请求，最终落入 `cancelled`。
