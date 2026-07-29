# PiAgent v2 设计约束

本文记录当前架构必须保持的关键约束。完整模块说明见 `ARCHITECTURE.md`。

## 1. Server owns durable state

SQLite 是 Conversation、Message、ToolCall、Run、RunEvent 和加密凭据的事实来源。React state 是服务端快照的临时投影，不得成为任务生命周期或凭据的唯一存储。

## 2. Run lifetime is independent from subscribers

```text
Run:        queued -> running -> completed | failed
                              -> cancelling -> cancelled

Subscriber: connect -> replay(afterSeq) -> live -> disconnect
```

订阅者断开不会访问 Agent 的 abort controller。只有显式取消命令或进程关闭可以终止 Run。

## 3. Persist before publish

任何 `RunEvent` 都必须先在 SQLite 事务中落库并更新读取投影，再发布给实时订阅者。客户端以 `(runId, seq)` 去重和续传。

## 4. Commands are idempotent

`POST /runs` 必须携带 `idempotencyKey`。同一会话内相同 Key 返回同一个 Run；数据库同时保证一个会话最多只有一个 active Run。

## 5. Credentials stay server-side

API Key 不进入任务命令、不进入 URL、不进入浏览器持久化。服务端只暴露“是否已配置”，不返回明文。加密主密钥必须与 SQLite 密文分开管理。

## 6. Desktop stays loopback-only

Electron 中的 Web 和 API 只绑定 `127.0.0.1`，端口由系统动态分配。API 仅允许对应 Renderer Origin；运行时 API override 只接受 `localhost`/`127.0.0.1`。
应用必须保持单实例，避免共享数据库的两个 Server 互相改变 active Run 状态。

## 7. Process restart is not stream resume

页面刷新恢复与进程恢复是两个问题。当前系统保证前者；进程重启后 active Run 被标记为 `interrupted`，不会声称从 LLM 字节流中间继续执行。

## 8. Public deployment requires a new security boundary

当前 Server 拥有文件读写和命令执行能力。公网或多用户部署必须先加入认证、授权、租户级凭据/数据库隔离、工作区沙箱、SSRF 防护、限流与审计。
