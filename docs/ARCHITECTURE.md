# PiAgent 当前架构

## 总览

PiAgent 是一个本地优先、前后端分离的 monorepo。React 页面不拥有任务生命周期；任务、消息、工具调用、凭据和可重放事件均由本地 API Server 管理。

```text
Browser / Electron Renderer
        │ HTTP commands + replayable SSE
        ▼
apps/server
  ├─ HTTP API / CORS
  ├─ RunManager
  ├─ CredentialVault
  └─ AppDatabase (SQLite/WAL)
        │
        ▼
packages/agent
  ├─ OpenAI-compatible streaming client
  ├─ ReAct/tool loop
  ├─ context compression
  └─ filesystem/command tools
```

`packages/contracts` 是前后端共享边界，定义 `Conversation`、`Message`、`Run`、`ToolCall`、`RunEvent` 和启动命令。

## 模块职责

| 模块 | 职责 |
|---|---|
| `apps/web` | 加载服务端快照、发送命令、订阅/重放任务事件、渲染 UI |
| `apps/server` | 会话 API、任务生命周期、事件持久化、凭据加密、目录浏览 |
| `apps/desktop` | 启动本地静态 Web 与 API、创建窗口、管理桌面数据目录、生成 DMG |
| `packages/agent` | 模型流、工具调用循环、上下文压缩和本地工具 |
| `packages/contracts` | 跨进程类型与事件协议 |

## 数据所有权

SQLite 是业务状态的唯一事实来源：

- `conversations`
- `messages`
- `tool_calls`
- `runs`
- `run_events`
- `credentials`

浏览器存储只保留界面设置和旧数据迁移标记，不保存 API Key，也不决定任务是否仍在执行。

数据库使用 WAL 和外键约束。写入任务事件时，同一事务同步更新消息/工具调用投影；查询会话时直接返回可渲染快照。

## 命令与订阅分离

启动任务：

```http
POST /v1/conversations/:conversationId/runs
```

订阅任务：

```http
GET /v1/runs/:runId/events?after=<lastSeq>
Accept: text/event-stream
```

关闭页面、刷新页面或断开 SSE 只会移除订阅者，不会触发 Agent 的 `AbortController`。只有取消接口或进程退出会停止任务。

## 事件一致性

每个事件遵守以下顺序：

1. 为 Run 分配下一个单调递增的 `seq`。
2. 写入 `run_events`。
3. 在同一 SQLite 事务中更新消息、工具调用和 Run 投影。
4. 将已提交事件发布给当前订阅者。

页面重新连接时先读取 `seq > after` 的历史事件，再接收实时事件。客户端丢弃不大于当前游标的重复事件。

## 凭据

API Key 不属于 `StartRunRequest`。保存接口将其交给 `CredentialVault`：

- AES-256-GCM
- 每次写入随机 12-byte IV
- ciphertext、IV 和 auth tag 存入 SQLite
- 32-byte 主密钥来自环境变量或独立权限文件
- 登出删除 `credentials` 中的记录

运行任务和连接测试都只从服务端凭据仓库读取 Key。

## Electron

生产桌面包不运行 Next.js 开发服务器：

1. Next.js 使用 `output: export` 生成静态页面。
2. esbuild 将 API Server 与 Agent/Contracts 打成一个 CommonJS 运行包。
3. `better-sqlite3` 作为原生依赖随 Electron 重建并解包。
4. 主进程分别在 `127.0.0.1` 的动态端口启动静态 Web 和 API。
5. Web 通过受限的 `?api=http://127.0.0.1:<port>` 参数发现 API。

Electron 强制单实例，避免多个进程同时打开同一数据库。Renderer 启用 `contextIsolation`
和 `sandbox`，禁用 Node integration，并阻止导航到外部来源；只有 `http:` 和 `https:`
链接可以交给系统浏览器打开。桌面 API 的 CORS 白名单只包含当前随机 Web Origin。

## 故障边界

- Renderer 刷新：任务继续，页面重放事件。
- SSE 断开：任务继续，重连后从游标恢复。
- API/Electron 进程退出：LLM 流终止。
- 下次启动：遗留的 `queued/running/cancelling` Run 标记为 `interrupted`。

“进程重启后继续执行到一半的工具链”需要持久化步骤检查点和工具幂等协议，当前版本不提供。
