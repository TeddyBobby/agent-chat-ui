# {{Pi}}Agent

本地优先的 AI 编程助手。前端、任务服务器、Agent 运行时和 Electron 壳使用 pnpm monorepo 管理。

## 快速开始

```bash
pnpm install
pnpm dev
```

- Web UI: http://localhost:3001/chat
- Server: http://127.0.0.1:8787
- Health check: http://127.0.0.1:8787/health

服务器数据默认保存在 `.data/pi-agent.db`。DeepSeek 可通过项目根目录的环境变量配置：

```bash
DEEPSEEK_API_KEY=sk-xxx
```

Ollama 使用 `http://localhost:11434/v1`，不需要 API Key。

## Workspace

```text
apps/
  web/       Next.js 前端，只负责界面和事件投影
  server/    HTTP、SQLite、RunManager、可重放 SSE
  desktop/   Electron 桌面壳
packages/
  agent/     PiAgent 循环和本地工具
  contracts/ 前后端共享的命令、实体和事件协议
```

## 可恢复任务流

创建任务和订阅任务是两条独立接口：

```text
POST /v1/conversations/:id/runs       -> 202 + runId
GET  /v1/runs/:id/events?after=<seq>  -> replay + live SSE
POST /v1/runs/:id/cancel              -> explicit cancellation
```

每个事件先写入 SQLite，再发送给订阅者。页面刷新只会断开订阅，不会取消 Agent；新页面从会话的 `activeRun.lastSeq` 继续订阅。相同 `idempotencyKey` 不会重复启动任务。

服务器进程重启时，尚未完成的运行会标记为 `interrupted`。当前版本保证浏览器刷新、标签页关闭和 SSE 断线后的恢复，不保证从已经终止的 LLM 流中间自动续跑。

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

后端集成测试会真实模拟：启动任务、接收一部分 SSE、断开页面连接、等待后台完成、携带最后事件序号重新连接。

## License

MIT © TeddyBobby
