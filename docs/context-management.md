# 上下文管理

实现位置：`packages/agent/src/core.ts`。

## 目标

长任务中保留最近的指令、工具结果和关键历史，同时避免超过模型 context window。会话快照中的 `contextTokens` 是近似值，实际压缩发生在 Agent 内部消息数组。

## 触发条件

- 每执行 5 个 Agent step 检查一次。
- 估算 token 数超过 `contextLimit × 75%` 时压缩。
- 默认 `contextLimit` 为 128,000，可由模型配置随 `StartRunRequest` 传入。

## 压缩策略

```text
System prompt ─────────────────────────────► 永久保留
较旧的中间消息 ─► 同一模型生成摘要 ─────────► 一条历史摘要
最近约 30% token 窗口 ─────────────────────► 原样保留
```

摘要最多使用约 `contextLimit × 10%` 的预算，并明确标记为历史参考而不是当前用户指令。摘要失败时回退为保留 System prompt 与最近窗口，避免整个任务因辅助压缩失败而终止。

## 传递链路

```text
apps/web 模型配置
  -> StartRunRequest.contextLimit
  -> apps/server RunManager
  -> PiAgent AgentConfig.contextLimit
  -> _estimateTokens() / _compressContext()
```

## 限制

- token 统计是估算，不是供应商 tokenizer 的精确值。
- 摘要使用当前主模型，不支持单独的低成本摘要模型。
- 工具结果不会先分层裁剪，而是随中间历史一起摘要。
- 每次压缩基于当前消息集合重新生成摘要。
