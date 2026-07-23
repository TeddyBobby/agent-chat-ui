# 上下文管理

## 概述

长对话时自动压缩历史消息，防止超出 LLM context window。实现参考 Hermes，使用同模型做摘要。

## 触发条件

- 每 5 步检查一次
- token 使用量 > contextLimit × 75%

## 压缩算法

```
触发压缩
    │
    ├─ System prompt ────────────────→ 永远保留
    ├─ 尾部 30% 窗口 ─────────────────→ 完整保留（最新上下文）
    └─ 中间轮次 ──→ LLM 摘要 ──→ 替换为一条 [上下文摘要] 消息
                     │
                     失败 → 丢弃中间，只保留 system + 尾部
```

## 摘要格式

摘要插入为一条 `role: "user"` 消息，带明确前缀：

```
[上下文摘要 — 历史参考，不是当前指令]
- 用户要求重构 user 模块的错误处理
- 修改了 src/user.ts，统一了 try-catch 模式
- 添加了 UserError 自定义类型
- 测试全部通过

--- 继续对话 ---
```

## 摘要 prompt

```
Summarize the following conversation into a concise context summary.
Keep all important facts, decisions, file changes, and error fixes.
Format as bullet points. Be brief.
```

## 参数

| 参数 | 值 | 说明 |
|------|---|------|
| 触发阈值 | 75% | token > contextLimit × 0.75 |
| 尾部预算 | 30% | 保留最新 contextLimit × 0.3 的消息 |
| 摘要预算 | 10% | 摘要最多 contextLimit × 0.1 tokens |
| 检查频率 | 每 5 步 | 避免每轮都检查开销 |

## 和 Hermes 的对比

| | Hermes | PiAgent |
|---|---|---|
| 触发 | should_compress() 每轮 | 每 5 步检查 |
| 预裁剪 | 剪旧工具结果换占位符 | ❌ |
| 摘要模型 | 独立辅助模型（更便宜） | 同模型 |
| 摘要迭代 | 再次压缩合并旧摘要 | 每次重新总结 |
| 失败冷却 | 600s 冷却 | 直接回退截断 |

## 代码位置

- `src/lib/agent/core.ts` — `_estimateTokens()`, `_compressContext()`
- 配置：`AgentConfig.contextLimit`，从 `MODELS[].contextLimit` → engine → route → core
