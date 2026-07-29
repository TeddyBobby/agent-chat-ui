# 持久化流式引擎

当前实现不再使用单次 `POST /api/chat` 把任务生命周期绑定到浏览器连接。启动命令与事件订阅是两条独立链路。

## 协议

```http
POST /v1/conversations/:conversationId/runs
Content-Type: application/json

{
  "content": "检查项目测试",
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1",
  "contextLimit": 128000,
  "idempotencyKey": "<uuid>"
}
```

响应 `202` 并返回 Run。随后客户端订阅：

```http
GET /v1/runs/:runId/events?after=12
Accept: text/event-stream
```

## 事件

```ts
run.started
assistant.delta
tool.started
tool.completed
run.completed
run.failed
run.cancelled
```

每个事件包含 `runId`、单调递增的 `seq` 和 `createdAt`。SSE 帧使用 `id: <seq>` 和 JSON `data`；服务端也接受查询参数 `after` 或 `Last-Event-ID`。

## 服务端流程

```text
Agent StepEvent
    │
    ▼
RunManager.publish
    │
    ├─ SQLite transaction:
    │    append run_events
    │    update message/tool/run projection
    │
    └─ notify live subscribers
```

新订阅先读取 `seq > after` 的历史事件，然后加入实时订阅集合。终态事件发送完毕后关闭 SSE。

## 客户端流程

`apps/web/src/lib/api.ts` 的 `streamRunEvents()` 负责：

1. 用当前 `lastSeq` 建立 SSE fetch。
2. 使用 `TextDecoder` 缓冲跨 chunk 的 SSE 帧。
3. 解析 `data:` JSON。
4. 按 `seq` 丢弃重复事件并更新游标。
5. 网络断开时带最新游标重连。

`page.tsx` 将事件投影到当前 Conversation 快照。页面初始化时重新查询服务端会话列表，发现 `activeRun` 后自动恢复订阅。

## 恢复范围

| 场景 | 行为 |
|---|---|
| 页面刷新 | Agent 继续；页面重放缺失事件 |
| 标签页关闭后重新打开 | Agent 继续；重新加载快照和事件 |
| SSE 短暂断网 | 带 `after` 重连 |
| 重复提交 | `idempotencyKey` 返回原 Run |
| 显式取消 | AbortController 停止模型请求 |
| Server/Electron 退出 | Run 下次启动标记为 `interrupted` |

反向代理部署时必须关闭 SSE 响应缓冲并设置足够长的读取超时。
